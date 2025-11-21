package expo.modules.mymodule

import android.app.Activity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.ContentValues
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
import android.provider.MediaStore
import android.util.Log
import androidx.annotation.RequiresApi
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.io.IOException

@RequiresApi(Build.VERSION_CODES.O)
class ScreenRecordService : Service() {

    companion object {
        const val START_RECORDING = "START_RECORDING"
        const val STOP_RECORDING = "STOP_RECORDING"
        const val KEY_RECORDING_CONFIG = "KEY_RECORDING_CONFIG"

        private const val NOTIFICATION_ID = 1
        private const val CHANNEL_ID = "screen_record_channel"
        private const val PREFS_NAME = "ScreenRecordPrefs"
        private const val KEY_LAST_URI = "latestVideoUri"
        private const val KEY_LAST_NAME = "latestVideoName"

        private val _isServiceRunning = MutableStateFlow(false)
        val isServiceRunning = _isServiceRunning.asStateFlow()

        private val _isRecorded = MutableStateFlow(false)
        val isRecorded = _isRecorded.asStateFlow()

        fun getSavedLatestInfo(context: Context): Pair<String?, String?> {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val uri = prefs.getString(KEY_LAST_URI, null)
            val name = prefs.getString(KEY_LAST_NAME, null)
            return Pair(uri, name)
        }
    }

    private lateinit var mediaProjectionManager: MediaProjectionManager
    private var mediaProjection: MediaProjection? = null
    private var recorder: MediaRecorder? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var videoUri: android.net.Uri? = null
    private var videoName: String? = null

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

                _isRecorded.value = false

                if (config != null && data != null && resultCode == Activity.RESULT_OK) {
                    startForegroundNotification()
                    startRecording(config, resultCode, data)
                } else {
                    Log.e("ScreenRecordService", "Invalid parameters for recording.")
                    stopSelf()
                }
            }
            STOP_RECORDING -> stopRecording()
        }
        return START_NOT_STICKY
    }

    private fun startForegroundNotification() {
        val notification = Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("Screen Recording")
            .setContentText("Recording screen and audio...")
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setOngoing(true)
            .build()

        // IMPORTANT: For Android 14 (API 34), you must specify microphone type
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val serviceType = if (Build.VERSION.SDK_INT >= 34) { // Android 14+
                 ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
            } else {
                 ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
            }
            
            startForeground(NOTIFICATION_ID, notification, serviceType)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun startRecording(config: ScreenRecordConfig, resultCode: Int, data: Intent) {
        _isServiceRunning.value = true

        try {
            mediaProjection = mediaProjectionManager.getMediaProjection(resultCode, data)
            mediaProjection?.registerCallback(object : MediaProjection.Callback() {
                override fun onStop() {
                    stopRecording()
                }
            }, null)

            // Initialize URI
            val values = ContentValues().apply {
                put(MediaStore.Video.Media.RELATIVE_PATH, "Movies/")
                put(MediaStore.Video.Media.MIME_TYPE, "video/mp4")
                put(MediaStore.Video.Media.IS_PENDING, 1)
                videoName = "record_${System.currentTimeMillis()}.mp4"
                put(MediaStore.Video.Media.DISPLAY_NAME, videoName)
            }
            videoUri = contentResolver.insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, values)
            
            if (videoUri == null) throw IOException("Failed to create video URI")

            val fd = contentResolver.openFileDescriptor(videoUri!!, "w")!!.fileDescriptor

            recorder = MediaRecorder()
            
            // --- STRICT ORDER FOR MEDIA RECORDER ---
            // 1. Audio/Video Sources
            recorder?.setAudioSource(MediaRecorder.AudioSource.MIC) // ADDED AUDIO SOURCE
            recorder?.setVideoSource(MediaRecorder.VideoSource.SURFACE)
            
            // 2. Output Format
            recorder?.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            
            // 3. Encoders
            recorder?.setAudioEncoder(MediaRecorder.AudioEncoder.AAC) // ADDED AUDIO ENCODER
            recorder?.setVideoEncoder(MediaRecorder.VideoEncoder.H264)
            
            // 4. Configuration
            recorder?.setVideoSize(config.width, config.height)
            recorder?.setVideoEncodingBitRate(config.bitrate)
            recorder?.setVideoFrameRate(config.frameRate)
            recorder?.setAudioEncodingBitRate(128000) // 128kbps audio
            recorder?.setAudioSamplingRate(44100)     // 44.1kHz
            
            // 5. Output File
            recorder?.setOutputFile(fd)

            // 6. Prepare and Start
            recorder?.prepare()
            
            virtualDisplay = mediaProjection?.createVirtualDisplay(
                "ScreenRecordDisplay",
                config.width,
                config.height,
                resources.displayMetrics.densityDpi,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                recorder?.surface,
                null,
                null
            )
            
            recorder?.start()
            Log.d("ScreenRecordService", "Recording started successfully with Audio.")

        } catch (e: Exception) {
            Log.e("ScreenRecordService", "Failed to start recording: ${e.message}", e)
            cleanupResources()
            _isServiceRunning.value = false
            stopSelf()
        }
    }

    private fun stopRecording() {
        if (!_isServiceRunning.value) return

        CoroutineScope(Dispatchers.IO).launch {
            try {
                // Stop recorder safely
                try {
                    recorder?.stop()
                } catch (e: RuntimeException) {
                    // If stop() is called immediately after start(), it fails. safe to ignore.
                    Log.e("ScreenRecordService", "Recorder stop failed: ${e.message}")
                }
                
                cleanupResources()

                // Finalize file
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && videoUri != null) {
                    contentResolver.update(
                        videoUri!!,
                        ContentValues().apply { put(MediaStore.Video.Media.IS_PENDING, 0) },
                        null,
                        null
                    )
                }

                delay(500) // Small buffer to ensure IO writes finish
                saveLatestVideo()
            } catch (e: Exception) {
                Log.e("ScreenRecordService", "Error stopping recording", e)
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
            recorder?.release()
            virtualDisplay?.release()
            mediaProjection?.stop()
        } catch (_: Exception) {}
        
        recorder = null
        virtualDisplay = null
        mediaProjection = null
    }

    private fun saveLatestVideo() {
        if (videoUri == null || videoName == null) return
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit()
            .putString(KEY_LAST_URI, videoUri.toString())
            .putString(KEY_LAST_NAME, videoName)
            .apply()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID, "Screen Recording", NotificationManager.IMPORTANCE_LOW
            )
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }
}