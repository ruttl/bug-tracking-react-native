package expo.modules.mymodule

import android.Manifest
import android.app.Activity.RESULT_OK
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioManager
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.first

class MyModule : Module() {
    private val context get() = requireNotNull(appContext.reactContext)
    private val activity get() = requireNotNull(appContext.activityProvider?.currentActivity)

    private val REQUEST_CODE_SCREEN_CAPTURE = 1002
    private var requestPermissionPromise: Promise? = null
    private val coroutineScope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    
    private var permissionResultCode: Int = 0
    private var permissionResultData: Intent? = null

    override fun definition() = ModuleDefinition {
        Name("MyModule")

        Function("isRecording") { ScreenRecordService.isServiceRunning.value }

        Function("setAudioEnabled") { enabled: Boolean ->
            try {
                val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
                audioManager.isMicrophoneMute = !enabled
            } catch (e: Exception) { Log.e("MyModule", "Mic toggle error", e) }
        }

        AsyncFunction("requestPermissions") { promise: Promise ->
            try {
                val mpManager = activity.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
                requestPermissionPromise = promise
                activity.startActivityForResult(mpManager.createScreenCaptureIntent(), REQUEST_CODE_SCREEN_CAPTURE)
            } catch (e: Exception) {
                promise.reject("ERR_PERM", e.message, e)
            }
        }

        AsyncFunction("startRecordingService") { promise: Promise ->
            if (permissionResultData == null) {
                promise.reject("ERR_NO_DATA", "No permission data found", null)
                return@AsyncFunction
            }

            try {
                val metrics = context.resources.displayMetrics
                val width = (metrics.widthPixels / 16) * 16
                val height = (metrics.heightPixels / 16) * 16
                val bitrate = (width * height * 4).coerceAtLeast(3_000_000)
                val config = ScreenRecordConfig(width, height, bitrate, 30)

                val hasMicPerm = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

                val serviceIntent = Intent(context, ScreenRecordService::class.java).apply {
                    action = ScreenRecordService.START_RECORDING
                    putExtra(ScreenRecordService.KEY_RECORDING_CONFIG, config)
                    putExtra("resultCode", permissionResultCode)
                    putExtra("data", permissionResultData)
                    putExtra("enableAudio", hasMicPerm)
                }

                // API 26+ requires startForegroundService
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent)
                } else {
                    context.startService(serviceIntent)
                }

                coroutineScope.launch {
                    try {
                        withTimeout(10000L) {
                            ScreenRecordService.isServiceRunning.filter { it }.first()
                        }
                        promise.resolve(true)
                    } catch (e: Exception) {
                        promise.reject("START_TIMEOUT", "Service failed to report as running", e)
                    }
                }
            } catch (e: Exception) {
                Log.e("MyModule", "Failed to start service", e)
                promise.reject("START_ERROR", e.message, e)
            }
        }

        AsyncFunction("stopRecording") { promise: Promise ->
            val stopIntent = Intent(context, ScreenRecordService::class.java).apply {
                action = ScreenRecordService.STOP_RECORDING
            }
            context.startService(stopIntent)

            coroutineScope.launch {
                try {
                    withTimeout(15000L) {
                        ScreenRecordService.isRecorded.filter { it }.first()
                    }
                    val (uri, name) = ScreenRecordService.getSavedLatestInfo(context)
                    promise.resolve(if (uri != null) mapOf("uri" to uri, "name" to name) else null)
                } catch (e: Exception) {
                    promise.reject("STOP_TIMEOUT", "Service stop timed out", e)
                }
            }
        }

        OnActivityResult { _, result ->
            if (result.requestCode == REQUEST_CODE_SCREEN_CAPTURE) {
                if (result.resultCode == RESULT_OK && result.data != null) {
                    permissionResultCode = result.resultCode
                    permissionResultData = result.data
                    requestPermissionPromise?.resolve(true)
                } else {
                    requestPermissionPromise?.resolve(false)
                }
                requestPermissionPromise = null
            }
        }
    }
}