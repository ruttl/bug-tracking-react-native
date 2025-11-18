package expo.modules.mymodule

import android.app.*
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

@RequiresApi(Build.VERSION_CODES.O)
class ScreenRecordService : Service() {

    companion object {
        const val START_RECORDING = "START_RECORDING"
        const val STOP_RECORDING = "STOP_RECORDING"
        const val KEY_RECORDING_CONFIG = "KEY_RECORDING_CONFIG"

        private val _isServiceRunning = MutableStateFlow(false)
        val isServiceRunning = _isServiceRunning.asStateFlow()

        private val _isRecorded = MutableStateFlow(false)
        val isRecorded = _isRecorded.asStateFlow()

        var latestVideoUri: String? = null
        var latestVideoName: String? = null

        private const val NOTIFICATION_ID = 1
        private const val CHANNEL_ID = "screen_record_channel"

        private const val PREFS_NAME = "ScreenRecordPrefs"
        private const val KEY_LAST_URI = "latestVideoUri"
        private const val KEY_LAST_NAME = "latestVideoName"

        fun getSavedLatestInfo(context: Context): Pair<String?, String?> {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val uri = prefs.getString(KEY_LAST_URI, null)
            val name = prefs.getString(KEY_LAST_NAME, null)
            Log.d("ScreenRecordService", "getSavedLatestInfo() => uri=$uri, name=$name")
            return Pair(uri, name)
        }
    }

    private var mediaProjection: MediaProjection? = null
    private var recorder: MediaRecorder? = null
    private var virtualDisplay: VirtualDisplay? = null
    private lateinit var mediaProjectionManager: MediaProjectionManager
    private var videoUri: android.net.Uri? = null
    private var videoName: String? = null

    override fun onCreate() {
        super.onCreate()
        mediaProjectionManager = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        createNotificationChannel()
        Log.d("ScreenRecordService", "Service created")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            START_RECORDING -> {
                val config = intent.getParcelableExtra<ScreenRecordConfig>(KEY_RECORDING_CONFIG)
                val resultCode = intent.getIntExtra("resultCode", Activity.RESULT_CANCELED)
                val data: Intent? = intent.getParcelableExtra("data")

                _isRecorded.value = false

                if (config != null && data != null && resultCode == Activity.RESULT_OK) {
                    Log.d("ScreenRecordService", "Starting recording...")
                    val notification = createNotification()
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        startForeground(
                            NOTIFICATION_ID,
                            notification,
                            ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
                        )
                    } else {
                        startForeground(NOTIFICATION_ID, notification)
                    }
                    startRecording(config, resultCode, data)
                } else {
                    Log.e("ScreenRecordService", "Invalid recording params: $config / $data / $resultCode")
                }
            }

            STOP_RECORDING -> {
                Log.d("ScreenRecordService", "Stopping recording...")
                stopRecording()
            }
        }
        return START_STICKY
    }

    private fun startRecording(config: ScreenRecordConfig, resultCode: Int, data: Intent) {
        _isServiceRunning.value = true
        mediaProjection = mediaProjectionManager.getMediaProjection(resultCode, data)

        mediaProjection?.registerCallback(object : MediaProjection.Callback() {
            override fun onStop() {
                super.onStop()
                Log.d("ScreenRecordService", "MediaProjection stopped by system")
                stopRecording()
            }
        }, null)

        recorder = MediaRecorder()

        val resolver = contentResolver
        val values = ContentValues().apply {
            put(MediaStore.Video.Media.RELATIVE_PATH, "Movies/")
            put(MediaStore.Video.Media.MIME_TYPE, "video/mp4")
            put(MediaStore.Video.Media.IS_PENDING, 1)
            videoName = "record_${System.currentTimeMillis()}.mp4"
            put(MediaStore.Video.Media.DISPLAY_NAME, videoName)
        }

        videoUri = resolver.insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, values)
        val fileDescriptor = resolver.openFileDescriptor(videoUri!!, "w")!!.fileDescriptor

        recorder?.apply {
            setVideoSource(MediaRecorder.VideoSource.SURFACE)
            setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            setVideoEncoder(MediaRecorder.VideoEncoder.H264)
            setVideoSize(config.width, config.height)
            setVideoEncodingBitRate(config.bitrate)
            setVideoFrameRate(config.frameRate)
            setOutputFile(fileDescriptor)
            prepare()
            start()
        }

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
    }

    private fun stopRecording() {
        // Prevent this from running multiple times if called in quick succession
        if (!_isServiceRunning.value) {
            return
        }
        
        _isServiceRunning.value = false
        
        // Reset the signal *before* starting the async work.
        _isRecorded.value = false

        CoroutineScope(Dispatchers.IO).launch {
            try {
                recorder?.apply {
                    stop()
                    reset()
                    release()
                }
            } catch (e: Exception) {
                Log.e("ScreenRecordService", "Error stopping recorder: ${e.message}")
            }

            virtualDisplay?.release()
            mediaProjection?.stop()
            recorder = null
            virtualDisplay = null
            mediaProjection = null

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && videoUri != null) {
                val values = ContentValues().apply {
                    put(MediaStore.Video.Media.IS_PENDING, 0)
                }
                contentResolver.update(videoUri!!, values, null, null)
            }

            delay(1500) // Your original delay to let the file settle
            val verifiedUri = ensureUriExists(videoUri)

            if (verifiedUri != null) {
                Log.d("ScreenRecordService", "✅ Final verified video: $verifiedUri")

                latestVideoUri = verifiedUri.toString()
                latestVideoName = videoName

                val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                prefs.edit()
                    .putString(KEY_LAST_URI, latestVideoUri)
                    .putString(KEY_LAST_NAME, latestVideoName)
                    .apply()

                sendBroadcast(Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE, verifiedUri))
            } else {
                Log.e("ScreenRecordService", "❌ No valid video URI found after recording!")
            }

            // This is the "DONE" signal, fired *after* prefs are saved.
            _isRecorded.value = true
            
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
        }
    }

    private suspend fun ensureUriExists(uri: android.net.Uri?): android.net.Uri? {
        if (uri == null) return null
        repeat(3) { attempt ->
            try {
                contentResolver.openFileDescriptor(uri, "r")?.use { return uri }
            } catch (e: Exception) {
                Log.w("ScreenRecordService", "Attempt ${attempt + 1}: URI not ready yet → retrying...")
                delay(1000)
            }
        }
        return null
    }

    private fun createNotification(): Notification {
        return Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("Screen Recording")
            .setContentText("Recording in progress")
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setOngoing(true)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Screen Recording",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null
}