package expo.modules.mymodule

import android.app.Activity.RESULT_OK
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.annotation.RequiresApi
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withTimeout
import java.io.File

@RequiresApi(Build.VERSION_CODES.O)
class MyModule : Module() {

    private val context get() = requireNotNull(appContext.reactContext)
    private val activity get() = requireNotNull(appContext.activityProvider?.currentActivity)
    private val REQUEST_CODE_SCREEN_CAPTURE = 1002

    override fun definition() = ModuleDefinition {

        Name("MyModule")

        // ✅ Check if currently recording
        Function("isRecording") {
            ScreenRecordService.isServiceRunning.value
        }

        // ✅ Check if last recording is complete
        Function("isRecorded") {
            ScreenRecordService.isRecorded.value
        }

        // ✅ Start screen recording
        Function("startRecording") {
            if (!ScreenRecordService.isServiceRunning.value) {
                startScreenCapture()
            } else {
                Log.d("MyModule", "Recording already running")
            }
        }

        // ✅ Stop screen recording and return structured result
        AsyncFunction("stopRecording") { promise: Promise ->
            if (ScreenRecordService.isServiceRunning.value) {
                // 1. Send the stop command
                val stopIntent = Intent(context, ScreenRecordService::class.java).apply {
                    action = ScreenRecordService.STOP_RECORDING
                }
                context.startForegroundService(stopIntent)

                // 2. Launch a coroutine to wait for the *result*
                CoroutineScope(Dispatchers.IO).launch {
                    try {
                        // 3. Wait for the service to signal completion
                        awaitRecordingCompletion()

                        // 4. (NOW it's safe) Get the info from SharedPreferences
                        val (uri, name) = ScreenRecordService.getSavedLatestInfo(context)

                        if (uri != null && name != null) {
                            val result = mapOf("uri" to uri, "name" to name)
                            Log.d("MyModule", "✅ Recording finalized: $result")
                            promise.resolve(result)
                        } else {
                            Log.w("MyModule", "⚠️ Recording finished but no valid result found")
                            promise.resolve(null)
                        }
                    } catch (e: Exception) {
                        Log.e("MyModule", "❌ Error stopping recording", e)
                        promise.reject("STOP_RECORD_ERROR", e.message, e)
                    }
                }
            } else {
                Log.d("MyModule", "Recording not running")
                promise.resolve(null)
            }
        }

        // ✅ Get latest recorded video info
        Function("getLatestVideoInfo") {
            val (uri, name) = ScreenRecordService.getSavedLatestInfo(context)
            if (uri != null && name != null) {
                mapOf("uri" to uri, "name" to name)
            } else {
                Log.w("MyModule", "⚠️ No latest video found")
                null
            }
        }

        // ✅ Handle activity result from screen capture permission
        OnActivityResult { _, result ->
            if (result.requestCode == REQUEST_CODE_SCREEN_CAPTURE && result.resultCode == RESULT_OK) {
                val captureData = requireNotNull(result.data)

                // Note: This filePath is not used by your service, which uses MediaStore.
                // This is fine, but just be aware.
                val fileName = "screen_record_${System.currentTimeMillis()}.mp4"
                val filePath = "/storage/emulated/0/Movies/$fileName"

                val config = ScreenRecordConfig(
                    width = 1080,
                    height = 1920,
                    bitrate = 8_000_000,
                    frameRate = 30,
                    filePath = filePath 
                )

                startScreenRecordService(config, result.resultCode, captureData)
            }
        }
    }

    // ✅ Launch system permission for screen capture
    private fun startScreenCapture() {
        val mediaProjectionManager =
            activity.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        val captureIntent = mediaProjectionManager.createScreenCaptureIntent()
        activity.startActivityForResult(captureIntent, REQUEST_CODE_SCREEN_CAPTURE)
    }

    // ✅ Start recording foreground service
    private fun startScreenRecordService(config: ScreenRecordConfig, resultCode: Int, data: Intent) {
        val serviceIntent = Intent(context, ScreenRecordService::class.java).apply {
            action = ScreenRecordService.START_RECORDING
            putExtra(ScreenRecordService.KEY_RECORDING_CONFIG, config)
            putExtra("resultCode", resultCode)
            putExtra("data", data)
        }
        context.startForegroundService(serviceIntent)
    }

    /**
     * Waits for the ScreenRecordService to finish saving the file.
     * It does this by observing the `isRecorded` StateFlow, which the
     * service sets to `true` *after* saving to SharedPreferences.
     */
    private suspend fun awaitRecordingCompletion() {
        try {
            // Wait a maximum of 20 seconds for the service to finish
            withTimeout(20000L) {
                ScreenRecordService.isRecorded
                    .filter { it == true } // Wait for the value to become true
                    .first() // Get the first emission that matches and then stop collecting
            }
            Log.d("MyModule", "🏁 Service signaled recording is complete.")
        } catch (e: TimeoutCancellationException) {
            Log.e("MyModule", "⌛ Timeout waiting for recording to finish.")
            throw e // Re-throw to be caught by the promise reject
        }
    }
}