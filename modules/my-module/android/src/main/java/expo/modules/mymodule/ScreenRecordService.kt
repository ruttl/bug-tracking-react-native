package expo.modules.mymodule

import android.app.Activity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.MediaRecorder
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.IBinder
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
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
                if (file.exists() && file.length() > 0) {
                    return Pair("file://$path", file.name)
                }
            }
            return Pair(null, null)
        }
    }

    private lateinit var mediaProjectionManager: MediaProjectionManager
    private var mediaProjection: MediaProjection? = null
    private var recorder: MediaRecorder? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var outputFile: File? = null

    override fun onCreate() {
        super.onCreate()
        mediaProjectionManager = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            START_RECORDING -> {
                val config = intent.getParcelableExtra<ScreenRecordConfig>(KEY_RECORDING_CONFIG)
                val resultCode = intent.getIntExtra("resultCode", Activity.RESULT_CANCELED)
                val data = intent.getParcelableExtra<Intent>("data")
                val enableAudio = intent.getBooleanExtra("enableAudio", true)

                _isRecorded.value = false

                if (config != null && data != null && resultCode == Activity.RESULT_OK) {
                    startForegroundNotification(enableAudio)
                    startRecording(config, resultCode, data, enableAudio)
                } else {
                    stopSelf()
                }
            }
            STOP_RECORDING -> {
                // Ensure we call startForeground to satisfy the promise if started via startForegroundService
                startForegroundNotification(false)
                stopRecording()
            }
        }
        return START_NOT_STICKY
    }

    private fun startForegroundNotification(enableAudio: Boolean) {
        val notification = Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("Screen Recording")
            .setContentText("Recording in progress...")
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setOngoing(true)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val serviceType = if (false) {
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
            } else {
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
            }
            startForeground(NOTIFICATION_ID, notification, serviceType)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun startRecording(config: ScreenRecordConfig, resultCode: Int, data: Intent, enableAudio: Boolean) {
        try {
            mediaProjection = mediaProjectionManager.getMediaProjection(resultCode, data)
            mediaProjection?.registerCallback(object : MediaProjection.Callback() {
                override fun onStop() {
                    stopRecording()
                }
            }, null)

            outputFile = File(cacheDir, "rec_${System.currentTimeMillis()}.mp4")
            
            recorder = MediaRecorder()
            
            if (enableAudio) {
                recorder?.setAudioSource(MediaRecorder.AudioSource.MIC)
            }
            recorder?.setVideoSource(MediaRecorder.VideoSource.SURFACE)
            recorder?.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            
            recorder?.setVideoEncoder(MediaRecorder.VideoEncoder.H264)
            if (enableAudio) {
                recorder?.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            }
            
            recorder?.setVideoSize(config.width, config.height)
            recorder?.setVideoEncodingBitRate(config.bitrate)
            recorder?.setVideoFrameRate(config.frameRate)
            
            if (enableAudio) {
                recorder?.setAudioEncodingBitRate(128000)
                recorder?.setAudioSamplingRate(44100)
            }

            recorder?.setOutputFile(outputFile!!.absolutePath)
            
            recorder?.setOnErrorListener { mr, what, extra -> 
                Log.e("ScreenRec", "MediaRecorder Error: $what, $extra")
            }

            recorder?.prepare()

            virtualDisplay = mediaProjection?.createVirtualDisplay(
                "ScreenRec",
                config.width,
                config.height,
                resources.displayMetrics.densityDpi,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_PRESENTATION,
                recorder?.surface,
                null,
                null
            )

            recorder?.start()
            _isServiceRunning.value = true
            Log.d("ScreenRec", "Started writing to: ${outputFile?.absolutePath}")

        } catch (e: Exception) {
            Log.e("ScreenRec", "Start failed", e)
            cleanupResources()
            stopSelf()
        }
    }

    private fun stopRecording() {
        if (!_isServiceRunning.value) return

        CoroutineScope(Dispatchers.IO).launch {
            try {
                try {
                    recorder?.stop()
                } catch (e: RuntimeException) {
                   Log.e("ScreenRec", "Stop failed (no frames?): ${e.message}")
                   if (outputFile?.exists() == true) outputFile?.delete()
                }

                cleanupResources()

                if (outputFile?.exists() == true && outputFile!!.length() > 0) {
                    val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    prefs.edit().putString(KEY_LAST_PATH, outputFile!!.absolutePath).apply()
                    Log.d("ScreenRec", "File ready: ${outputFile!!.length()} bytes")
                } else {
                    Log.e("ScreenRec", "File is empty after stop")
                }

            } catch (e: Exception) {
                Log.e("ScreenRec", "Error stopping", e)
            } finally {
                _isServiceRunning.value = false
                _isRecorded.value = true
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
        }
    }

    private fun cleanupResources() {
        try {
            recorder?.reset()
            recorder?.release()
            virtualDisplay?.release()
            mediaProjection?.stop()
        } catch (_: Exception) { }
        recorder = null
        virtualDisplay = null
        mediaProjection = null
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID, "Screen Recording", NotificationManager.IMPORTANCE_LOW
            )
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }
    
    override fun onBind(intent: Intent?): IBinder? = null
}
