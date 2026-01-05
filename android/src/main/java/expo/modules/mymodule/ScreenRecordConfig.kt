package expo.modules.mymodule

import android.os.Parcel
import android.os.Parcelable

data class ScreenRecordConfig(
    val width: Int,
    val height: Int,
    val bitrate: Int,
    val frameRate: Int
) : Parcelable {

    constructor(parcel: Parcel) : this(
        parcel.readInt(),
        parcel.readInt(),
        parcel.readInt(),
        parcel.readInt()
    )

    override fun writeToParcel(parcel: Parcel, flags: Int) {
        parcel.writeInt(width)
        parcel.writeInt(height)
        parcel.writeInt(bitrate)
        parcel.writeInt(frameRate)
    }

    override fun describeContents(): Int = 0

    companion object CREATOR : Parcelable.Creator<ScreenRecordConfig> {
        override fun createFromParcel(parcel: Parcel): ScreenRecordConfig {
            return ScreenRecordConfig(parcel)
        }

        override fun newArray(size: Int): Array<ScreenRecordConfig?> {
            return arrayOfNulls(size)
        }
    }
}
