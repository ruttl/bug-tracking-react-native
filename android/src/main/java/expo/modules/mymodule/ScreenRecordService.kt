package expo.modules.mymodule

import android.app.*
import android.content.*
import android.content.pm.ServiceInfo
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.MediaRecorder
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.IBinder
import android.util.Log
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.io.File

class ScreenRecordService : Service() {

    companion object {
        const val START_RECORDING = "START_RECORDING"
        const val STOP_RECORDING = "STOP_RECORDING"
        const val KEY_RECORDING_CONFIG = "KEY_RECORDING_CONFIG"
        private const val NOTIFICATION_ID = 9543
        private const val CHANNEL_ID = "screen_record_channel_v2"
        private const val PREFS_NAME = "ScreenRecordPrefs"
        private const val KEY_LAST_PATH = "latestVideoPath"

        private val _isServiceRunning = MutableStateFlow(false)
        val isServiceRunning = _isServiceRunning.asStateFlow()

        private val _isRecorded = MutableStateFlow(false)
        val isRecorded = _isRecorded.asStateFlow()

        fun getSavedLatestInfo(context: Context): Pair<String?, String?> {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val path = prefs.getString(KEY_LAST_PATH, null)
            if (path != null) {
                val file = File(path)
                if (file.exists() && file.length() > 0) return Pair("file://$path", file.name)
            }
            return Pair(null, null)
        }
    }

    private var mediaProjection: MediaProjection? = null
    private var recorder: MediaRecorder? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var outputFile: File? = null
    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: return START_NOT_STICKY
        val enableAudio = intent.getBooleanExtra("enableAudio", true)

        if (action == START_RECORDING) {
            // STEP 1: Start Foreground immediately to satisfy OS
            startForegroundNotification(enableAudio)
            
            val config = intent.getParcelableExtra<ScreenRecordConfig>(KEY_RECORDING_CONFIG)
            val resultCode = intent.getIntExtra("resultCode", Activity.RESULT_CANCELED)
            val data = intent.getParcelableExtra<Intent>("data")

            if (config != null && data != null && resultCode == Activity.RESULT_OK) {
                _isRecorded.value = false
                startRecording(config, resultCode, data, enableAudio)
            } else {
                Log.e("ScreenRec", "Invalid intent data for recording")
                stopSelf()
            }
        } else if (action == STOP_RECORDING) {
            stopRecording()
        }
        return START_NOT_STICKY
    }

    private fun startForegroundNotification(enableAudio: Boolean) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, "Screen Recording", NotificationManager.IMPORTANCE_LOW)
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }

        val notification = Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("Recording Screen")
            .setContentText("Ruttl is currently recording...")
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setOngoing(true)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val type = if (enableAudio) {
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
            } else {
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
            }
            try {
                startForeground(NOTIFICATION_ID, notification, type)
            } catch (e: Exception) {
                Log.e("ScreenRec", "Failed to start foreground: ${e.message}")
            }
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun startRecording(config: ScreenRecordConfig, resultCode: Int, data: Intent, enableAudio: Boolean) {
        try {
            val mpManager = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
            mediaProjection = mpManager.getMediaProjection(resultCode, data)
            
            // Register callback to handle user revoking permission via system UI
            mediaProjection?.registerCallback(object : MediaProjection.Callback() {
                override fun onStop() {
                    stopRecording()
                }
            }, null)

            outputFile = File(cacheDir, "rec_${System.currentTimeMillis()}.mp4")
            
            recorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) MediaRecorder(this) else MediaRecorder()
            
            if (enableAudio) recorder?.setAudioSource(MediaRecorder.AudioSource.MIC)
            recorder?.setVideoSource(MediaRecorder.VideoSource.SURFACE)
            recorder?.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            recorder?.setVideoEncoder(MediaRecorder.VideoEncoder.H264)
            if (enableAudio) recorder?.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            
            recorder?.setVideoSize(config.width, config.height)
            recorder?.setVideoEncodingBitRate(config.bitrate)
            recorder?.setVideoFrameRate(config.frameRate)
            recorder?.setOutputFile(outputFile!!.absolutePath)
            
            recorder?.prepare()

            virtualDisplay = mediaProjection?.createVirtualDisplay(
                "ScreenCapture", config.width, config.height, resources.displayMetrics.densityDpi,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_PRESENTATION, recorder?.surface, null, null
            )

            recorder?.start()
            _isServiceRunning.value = true
        } catch (e: Exception) {
            Log.e("ScreenRec", "Recorder Start Failed: ${e.message}")
            cleanupResources()
            stopSelf()
        }
    }

    private fun stopRecording() {
        if (!_isServiceRunning.value) return
        serviceScope.launch {
            try {
                recorder?.stop()
                Log.d("ScreenRec", "Recorder stopped successfully")
            } catch (e: Exception) {
                Log.e("ScreenRec", "Recorder stop failed: ${e.message}")
            } finally {
                cleanupResources()
                if (outputFile?.exists() == true && outputFile!!.length() > 0) {
                    getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
                        .putString(KEY_LAST_PATH, outputFile!!.absolutePath).apply()
                }
                _isServiceRunning.value = false
                _isRecorded.value = true
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
        }
    }

    private fun cleanupResources() {
        try {
            recorder?.release()
            virtualDisplay?.release()
            mediaProjection?.stop()
        } catch (_: Exception) {}
        recorder = null
        virtualDisplay = null
        mediaProjection = null
    }

    override fun onDestroy() {
        cleanupResources()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}