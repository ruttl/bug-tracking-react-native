package expo.modules.mymodule

import android.Manifest
import android.app.Activity.RESULT_OK
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.util.DisplayMetrics
import androidx.annotation.RequiresApi
import androidx.core.content.ContextCompat
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withTimeout

@RequiresApi(Build.VERSION_CODES.O)
class MyModule : Module() {

    private val context get() = requireNotNull(appContext.reactContext)
    private val activity get() = requireNotNull(appContext.activityProvider?.currentActivity)

    private val REQUEST_CODE_SCREEN_CAPTURE = 1002
    private var requestPermissionPromise: Promise? = null
    private val coroutineScope = CoroutineScope(Dispatchers.Default)
    private var enableAudio = true
    
    // Store permission results
    private var permissionResultCode: Int = 0
    private var permissionResultData: Intent? = null

    override fun definition() = ModuleDefinition {
        Name("MyModule")

        Function("isRecording") { ScreenRecordService.isServiceRunning.value }
        Function("isRecorded") { ScreenRecordService.isRecorded.value }

        Function("getLatestVideoInfo") {
            val (uri, name) = ScreenRecordService.getSavedLatestInfo(context)
            if (uri != null && name != null) mapOf("uri" to uri, "name" to name) else null
        }

        AsyncFunction("requestPermissions") { promise: Promise ->
            if (ScreenRecordService.isServiceRunning.value) {
                promise.resolve(true)
                return@AsyncFunction
            }

            // 1. Check AUDIO Permission
            enableAudio = true
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                // Audio permission not granted, but we continue without audio
                enableAudio = false
            }
            
            // 2. Check NOTIFICATION Permission (Android 13+)
            if (Build.VERSION.SDK_INT >= 33) {
                if (ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                    promise.reject("PERMISSION_ERROR", "Notification permission not granted", null)
                    return@AsyncFunction
                }
            }

            requestPermissionPromise = promise
            try {
                val mpManager = activity.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
                val captureIntent = mpManager.createScreenCaptureIntent()
                activity.startActivityForResult(captureIntent, REQUEST_CODE_SCREEN_CAPTURE)
            } catch (e: Exception) {
                requestPermissionPromise = null
                promise.reject("ERR_START", "Failed to launch activity", e)
            }
        }

        AsyncFunction("startRecordingService") { promise: Promise ->
            if (ScreenRecordService.isServiceRunning.value) {
                promise.resolve(true)
                return@AsyncFunction
            }

            if (permissionResultData == null) {
                promise.reject("ERR_NO_PERM", "No recording permission data found. Call requestPermissions first.", null)
                return@AsyncFunction
            }

            try {
                val metrics = context.resources.displayMetrics
                
                // --- FIX FOR GLITCHES: ALIGN DIMENSIONS TO 16 ---
                val rawWidth = metrics.widthPixels
                val rawHeight = metrics.heightPixels
                
                val width = (rawWidth / 16) * 16
                val height = (rawHeight / 16) * 16

                // Higher bitrate for cleaner recording (approx 8Mbps)
                val bitrate = (width * height * 4).coerceAtLeast(2_000_000) 
                
                val config = ScreenRecordConfig(width, height, bitrate, 30)

                val serviceIntent = Intent(context, ScreenRecordService::class.java).apply {
                    action = ScreenRecordService.START_RECORDING
                    putExtra(ScreenRecordService.KEY_RECORDING_CONFIG, config)
                    putExtra("resultCode", permissionResultCode)
                    putExtra("data", permissionResultData)
                    putExtra("enableAudio", enableAudio)
                }
                
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent)
                } else {
                    context.startService(serviceIntent)
                }

                coroutineScope.launch {
                    try {
                        withTimeout(5000L) {
                            ScreenRecordService.isServiceRunning.filter { it }.first()
                        }
                        promise.resolve(true)
                    } catch (e: Exception) {
                        promise.reject("START_TIMEOUT", "Service failed to start", e)
                    }
                }
            } catch (e: Exception) {
                promise.reject("START_ERROR", "Failed to start service", e)
            }
        }

        AsyncFunction("stopRecording") { promise: Promise ->
            if (!ScreenRecordService.isServiceRunning.value) {
                promise.resolve(null)
                return@AsyncFunction
            }

            try {
                val stopIntent = Intent(context, ScreenRecordService::class.java).apply {
                    action = ScreenRecordService.STOP_RECORDING
                }
                context.startForegroundService(stopIntent)

                CoroutineScope(Dispatchers.IO).launch {
                    try {
                        withTimeout(10000L) {
                            ScreenRecordService.isRecorded.filter { it }.first()
                        }
                        val (uri, name) = ScreenRecordService.getSavedLatestInfo(context)
                        promise.resolve(if (uri != null) mapOf("uri" to uri, "name" to name) else null)
                    } catch (e: Exception) {
                        promise.reject("STOP_TIMEOUT", "Timeout waiting for recording to stop", e)
                    }
                }
            } catch (e: Exception) {
                promise.reject("STOP_ERROR", "Failed to stop service", e)
            }
        }

        OnActivityResult { _, result ->
            val promise = requestPermissionPromise
            requestPermissionPromise = null

            if (result.requestCode == REQUEST_CODE_SCREEN_CAPTURE) {
                if (result.resultCode == RESULT_OK && result.data != null) {
                    permissionResultCode = result.resultCode
                    permissionResultData = result.data
                    promise?.resolve(true)
                } else {
                    permissionResultCode = 0
                    permissionResultData = null
                    promise?.resolve(false) // Permission denied by user in system dialog
                }
            }
        }
    }
}
