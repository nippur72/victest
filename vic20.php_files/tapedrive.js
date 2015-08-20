$.extend(Config, new function() {
	/**
	 * Tape excess to add to tape to get Vic20 to understand it.
	 * 
	 * ATM have to add one as tom.tap is right on the edge of load-able.
	 */
	this.EXCESS = 0;

	/**
	 * Tape small pulse width.
	 */
	this.S = ((0x30 + this.EXCESS) * 8);

	/**
	 * Tape medium pulse width.
	 */
	this.M = ((0x42 + this.EXCESS) * 8);

	/**
	 * Tape large pulse width.
	 */
	this.L = ((0x56 + this.EXCESS) * 8);
	
	this.tapePlay = false;
});

EventTape = {
	createEjectEvent: function() {
		return {
			type:"EventTape",
			rewind: false,
			filepath: ""
		};
	},
	
	createInsertEvent: function(filepath) {
		return {
			type:"EventTape",
			rewind: false,
			filepath: filepath
		};
	},
	
	createRewindEvent: function() {
		return {
			type:"EventTape",
			rewind: true,
			filepath: ""
		};
	}
};

function EOFException(message) {
	this.message = message;
	
	console.debug("EOFException",message);
}

function InvalidFormatException(message) {
	this.message = message;
	
	console.debug("InvalidFormatException",message);
}

function TapeDrive() {

	// ============================================================
	// Attributes
	// ============================================================

	/**
	 * Tape peripheral.
	 */
	var tapeDatasource = null;

	this.isTapeLoaded = function() {
		return tapeDatasource!=null;
	}
	
	/**
	 * Used for generating pulses from the Tape peripheral.
	 */
	var pulseClock = 0;

	/**
	 * Width of pulse to be generating.
	 */
	var pulseWidth = 0;

	/**
	 * State of Tape drive motor.
	 */
	var tapeDriveMotor = false;

	// ============================================================
	// Methods
	// ============================================================

	/**
	 * Trigger the state of the tape drive motor.
	 * 
	 * @param isTapeMotorGoing
	 *            <code>true</code> if tape drive motor is going, else
	 *            <code>false</code> .
	 */
	this.triggerTapeMotor = function(isTapeMotorGoing) {
		tapeDriveMotor = isTapeMotorGoing;
		console.log("Tape drive motor "
				+ (isTapeMotorGoing ? "on" : "off"));
	}

	/**
	 * Read a bit from the tape drive. Note tape is expected to be playing, it
	 * is not checked here.
	 * 
	 * @return bit from tape drive.
	 */
	this.readTapeBit = function() {
		if (tapeDatasource != null && tapeDriveMotor) {
			if (++pulseClock > pulseWidth) {

				try {
					pulseWidth = tapeDatasource.nextPulseWidth();
				} catch (e) {
					if (e instanceof EOFException) {
						pulseWidth = -1;
					}
					else {
						throw e;
					}
				}
				if (pulseWidth == -1) {
					console.log("Tape end");
					// TODO how?
					Config.tapePlay = false;
					return true;
				}
				pulseClock = 0;
			}

			return pulseClock < (pulseWidth >> 1);
		}

		return true;
	}

	// ============================================================
	// IEventListener implementation
	// ============================================================\

	/**
	 * Handle a insert tape event.
	 */
	//@Override
	this.handleEvent = function(event) {
		if (event.rewind) {
			console.debug("rewind tape");
			tapeDatasource.rewind();
		} else if (event.filepath == null) {
			tapeDatasource = null;
			console.debug("eject tape");
		} else {
			try {
				console.debug("load tape");
				tapeDatasource = new TapFile(event.filepath);
			} catch (e) {
				if (e instanceof InvalidFormatException) {
					// Wasn't a TAP file, try CSM
					tapeDatasource = new CsmFile(event.filepath); 
				} else {
					throw e;
				}
			}
		}
		return true;
	}
	
	
	// ============================================================
	// Constructors.
	// ============================================================

	/**
	 * Constructor.
	 */
	//public TapeDrive() {
	EventManager.listen("EventTape", this.handleEvent);
	//}

}

function PulseWidthsFromBitData(bitData) {

	// ============================================================
	// Attributes
	// ============================================================

	/**
	 * Last bit sent.
	 */
	var bit = false;
	
	/**
	 * Count of bits sent within datum.
	 */
	var count = 0;

	// ============================================================
	// Methods
	// ============================================================

	/**
	 * Resets 
	 */
	this.reset = function() {
		count = 1;
	}
	
	this.reset();

	// ============================================================
	// IPulseData implementation
	// ============================================================

	/**
	 * {@inheritDoc}
	 */
	//@Override
	this.nextPulseWidth = function() {
		if (--count == 0) {
			count = 20;
			return Config.L; // More data bit 1
		}
		if (count == 19) {
			// More data bit 2
			return bitData.hasNextBit() ? Config.M : Config.S;
		}
		bit = ((count & 1) != 0) ? !bit : bitData.nextBit();

		return bit ? Config.M : Config.S;
	}
}


function PulseWidthSyncGenerator() {

	// ============================================================
	// Attributes
	// ============================================================

	/**
	 * Current sync number being sent.
	 */
	var value = 0;

	/**
	 * Count of bits sent.
	 */
	var count = 0;

	/**
	 * Last bit sent.
	 */
	var bit = false;

	/**
	 * XOR bit for each datum.
	 */
	var xor = 0;
	
	// ============================================================
	// Methods
	// ============================================================

	/**
	 * Reset the pulse width generator
	 * 
	 * @param isRepeat
	 *            <code>true</code> if this is the repeat sync pulse, else
	 *            <code>false</code>.
	 */
	this.reset = function(isRepeat) {
		// Repeat syncs start at a different number
		value = isRepeat ? 0x0A : 0x8A;
		count = 0;
	}
	
	// ============================================================
	// IPulseData implementation
	// ============================================================

	/**
	 * {@inheritDoc}
	 */
	// @Override
	this.nextPulseWidth = function() {
		if (--count < 0) {
			// value is 0x00 or 0x80 then end of sync
			if ((--value & 0xF) == 0) {
				throw new EOFException();
			}
			count = 19;
			xor = 1;
			// More data pulse 1
			return Config.L;
		}
		if (count == 18) {
			// More data pulse 2
			return Config.M;
		}
		if (count < 1) {
			// checksum bit
			return ((xor ^ count) != 0) ?Config.S : Config.M;
		}

		// Get next bit
		if ((count & 1) != 0) {
			bit = ((value >> (8 - (count >> 1))) & 1) != 0;
			xor ^= bit ? 1 : 0;
		}
		// invert current bit
		else {
			bit = !bit;
		}

		return bit ? Config.M : Config.S;
	}
}

function TapeBitDataStream() {

	// ============================================================
	// Attributes
	// ============================================================

	var data = null;
	var offset = 0;

	/**
	 * Current byte of data being worked on.
	 */
	var datum = 0;

	/**
	 * Current checksum for datum.
	 */
	var xor = 0;

	/**
	 * Current checksum for all data.
	 */
	var xorbyte = 0;

	/**
	 * Current bit position in datum.
	 */
	var bitpos = 0;

	/**
	 * <code>true</code> if end of stream checksum has been added.
	 */
	var hasAddedByteChecksum = false;

	// ============================================================
	// Methods
	// ============================================================

	/**
	 * Returns the next bit from the data, it could be a bit of a byte, a
	 * checksum bit, or a checksum byte bit.
	 * 
	 * @return Next bit of data stream.
	 * @throws EOFException
	 *             If there is no more data to read.
	 */
	this.nextBit = function() {
		datum >>= 1;
		bitpos++;

		// check-bit
		if (bitpos == 8) {
			return xor > 0;
		}

		// need more data
		if (bitpos > 8) {
			if (++offset >= data.length) {
				if (!hasAddedByteChecksum) {
					hasAddedByteChecksum = true;
					datum = xorbyte;
				} else {
					throw new EOFException();
				}
			} else {
				datum = data[offset] & 0xFF;
				xorbyte ^= datum;
			}

			bitpos = 0;
			xor = 1;
		}
		var result = datum & 1;
		xor ^= result;
		return result != 0;
	}

	/**
	 * Check whether there is another bit left in the stream.
	 * 
	 * @return <code>true</code> if there is data left in the s
	 */
	this.hasNextBit = function() {
		return offset < data.length;
	}

	/**
	 * Set the data that this stream is based off.
	 * 
	 * @param data
	 *            Array of data stream is to use.
	 * @param offset
	 *            Offset in data to start from.
	 * @param length
	 *            Length of data to read.
	 */
	this.setData = function(srcdata, offsetsrc, length) {
		data = new Array();//new byte[length];
		//System.arraycopy(data, offset, this.data, 0, length);
		for(var i=0; i<length; i++) data.push(srcdata[offsetsrc+i]);
		
		offset = -1;
		bitpos = 10;
		xorbyte = 0;
		hasAddedByteChecksum = false;
	}
}

function TapFile(data) {

	// ============================================================
	// Static Attributes
	// ============================================================

	/**
	 * Magic header string required at start of tap file.
	 */
	var FILE_MAGIC = "C64-TAPE-RAW";

	/**
	 * Total length of the header block.
	 */
	var HEADER_LENGTH = 0x15;

	// ============================================================
	// Attributes
	// ============================================================

	/**
	 * Input data.
	 */
	//var data = null;

	/**
	 * Current offset within input data.
	 */
	var offset = 0;

	/**
	 * Current offset within input data.
	 */
	var rewindOffset = 0;

	/**
	 * The version of tap file that is being read.
	 */
	var tapVersion = 0;

	/**
	 * The file data component size as reported by the tap file header.
	 */
	var fileDataSize = 0;

	/**
	 * Skip <code>count</code> bytes from the data input. If <code>count</code>
	 * will exceed file size then it is trimmed to the file size.
	 * 
	 * @param count
	 *            Number of bytes to skip.
	 */
	this.skipBytes = function(count) {
		offset += count;
		if (offset > data.length) {
			offset = data.length;
		}
	}

	/**
	 * Get next byte from the data input. If end-of-file return -1.
	 * 
	 * @return next byte from the data input, unless end-of-file in which case
	 *         it returns -1.
	 */
	this.nextByte = function() {
		if (offset == data.length) {
			// end of data
			return -1;
		}
		return data[offset++] & 0xFF;
	}

	// ============================================================
	// ITapeControl Implementation
	// ============================================================

	/**
	 * {@inheritDoc}
	 */
	//@Override
	this.rewind = function() {
		offset = rewindOffset;
	}

	// ============================================================
	// IPulseData implementation
	// ============================================================

	/**
	 * Generate the next pulse for
	 * 
	 * @return The length of the next pulse, or -1 if end-of-data.
	 */
	this.nextPulseWidth = function() {
		var datum = this.nextByte();

		// TODO
		// Report position every 4096 bits, or at end of file
		//if ((offset & 4095) == 0 || datum == -1) {
		//	Events.postEvent(new EventTapePosition(offset, fileDataSize));
		//}

		if (datum == 0) {
			if (tapVersion != 1) {
				// The data byte value of 00 represents overflow, any
				// pulselength of more than 255*8 cycles.
				datum = 512 << 8;
			} else {
				var nextByte = this.nextByte();
				if (nextByte == -1) {
					console.log("Unexpected end of tape encountered during extended pulse");
					return -1;
				}
				datum = nextByte;

				nextByte = this.nextByte();
				if (nextByte == -1) {
					console.log("Unexpected end of tape encountered during extended pulse");
					return -1;
				}

				datum |= nextByte << 8;

				nextByte = this.nextByte();
				if (nextByte == -1) {
					console.log("Unexpected end of tape encountered during extended pulse");
					return -1;
				}

				datum |= nextByte << 16;
			}
		}
		// Not end of file
		else if (datum != -1) {
			datum <<= 3;
		}

		return datum;
	}
	
	// ============================================================
	// Constructors
	// ============================================================

	/**
	 * Constructor to load a Tap file from a file.
	 * 
	 * @param filepath
	 *            The file path of the TAP file.
	 * @throws InvalidFormatException
	 *             If the file is not a Tap file.
	 */
	//public TapFile(String filepath) throws InvalidFormatException {
		/*FileInputStream inputStream = null;
		try {
			offset = 0;

			File file = new File(filepath);
			if (file.length() < HEADER_LENGTH) {
				throw new InvalidFormatException(
						"File is not a TAP file: file too small");
			}

			data = new byte[(int) file.length()];
			int b;
			inputStream = new FileInputStream(file);
			int cnt = 0;
			while ((b = inputStream.read()) != -1) {
				data[cnt++] = (byte) b;
			}
		} catch (IOException ex) {
			EventMessage.showError("Tape failed to load due to:\n"
					+ ex.getMessage());
		} finally {
			try {
				if (inputStream != null) {
					inputStream.close();
				}
			} catch (Exception ex) {
				ex.printStackTrace();
			}
		}*/

		// TODO
		if (FILE_MAGIC!=bin2String(data, 0, FILE_MAGIC.length)) {
			throw new InvalidFormatException(
					"File is not a TAP file: Header magic is incorrect");
		}
		this.skipBytes(FILE_MAGIC.length);

		tapVersion = this.nextByte();
		if (tapVersion != 0 && tapVersion != 1) {
			alert(
					"Tap version is not understood, version=" + tapVersion
							+ ", should be either 0 or 1");
		}

		this.skipBytes(3); // future expansion

		fileDataSize = this.nextByte() + (this.nextByte() << 8) + (this.nextByte() << 16)
				+ (this.nextByte() << 24);

		rewindOffset = offset;
	//}

}

function CsmFile(filedata) {

	// ============================================================
	// Static Attributes
	// ============================================================

	/**
	 * Size of a tape header.
	 */
	var HEADER_SIZE = 192;

	// ============================================================
	// Enumerations
	// ============================================================

	var TapeState = {
		PILOT_HEADER: 0, // S * 0x6A00
		SYNC_HEADER: 1, // $89, $88 etc
		HEADER: 2, HEADER_END_OF_DATA: 3, PILOT_HEADER_END: 4, // S * 0x4F
		SYNC_HEADER_REPEAT: 5, // $09, $08 etc
		HEADER_REPEAT: 6, HEADER_REPEAT_END_OF_DATA: 7, PILOT_HEADER_TRAILER: 8, // S *
		// 0x4E
		SILENCE: 9, // silence(0.4s)
		PILOT_DATA: 10, // Pilot S * 0x1A00
		SYNC_DATA: 11, //
		DATA: 12, DATA_END_OF_DATA: 13, PILOT_DATA_END: 14, // Pilot S * 0x4F
		SYNC_DATA_REPEAT: 15, // 
		DATA_REPEAT: 16, //
		DATA_REPEAT_END_OF_DATA: 17, PILOT_DATA_TRAILER: 18, END_TAPE: 19
	}

	// ============================================================
	// Attributes
	// ============================================================

	/**
	 * Current offset within input data.
	 */
	var currentOffset = 0;

	/**
	 * Input data.
	 */
	var data = filedata;

	/**
	 * Size of the tapes sub-data blocks.
	 */
	var dataSize = 0;

	/**
	 * Utility for converting byte data to tape bit data.
	 */
	var bitData = null;

	/**
	 * Utility for converting bit-data to pulse widths.
	 */
	var pulseData = null;

	/**
	 * Utility for generating sync pulse widths.
	 */
	var pulseDataSync = null;

	/**
	 * Current state of tape play back, e.g. Header, Data
	 */
	var state = 0;

	/**
	 * Temporary variable used for generating certain numbers of pulses.
	 */
	var count = 0;

	// ============================================================
	// ITapeControl Implementation
	// ============================================================

	/**
	 * {@inheritDoc}
	 */
	//@Override
	this.rewind = function() {
		pulseDataSync = new PulseWidthSyncGenerator();
		bitData = new TapeBitDataStream();
		pulseData = new PulseWidthsFromBitData(bitData);

		state = TapeState.PILOT_HEADER;
		count = 0x600;// Should be 6a00 but that takes forever
		currentOffset = 0;
	}

	// ============================================================
	// IPulseData Implementation
	// ============================================================

	/**
	 * Generate the next pulse for
	 * 
	 * @return The length of the next pulse, or -1 if end-of-data.
	 */
	this.nextPulseWidth = function() {
		if (state == TapeState.PILOT_HEADER) {
			if (--count == 0) {
				state = TapeState.SYNC_HEADER;
				console.log(state);
				pulseDataSync.reset(false);
			} else {
				return Config.S;
			}
		}
		if (state == TapeState.SYNC_HEADER) {
			try {
				return pulseDataSync.nextPulseWidth();
			} catch (ex) {
				if (!(ex instanceof EOFException )) throw ex;
				state = TapeState.HEADER;
				console.log(state);

				pulseData.reset();

				bitData.setData(data, currentOffset, HEADER_SIZE);
				console.log("header currentOffset = "
						+ currentOffset.toString(16));
				var startAddress = (data[currentOffset + 1] & 0xFF)
						| ((data[currentOffset + 2] & 0xFF) << 8);
				console.log("start address = "
						+ startAddress.toString(16));
				var endAddress = (data[currentOffset + 3] & 0xFF)
						| ((data[currentOffset + 4] & 0xFF) << 8);
				console.log("end address = "
						+ endAddress.toString(16));
				dataSize = endAddress - startAddress;
				console.log("dataSize = "
						+ dataSize.toString(16));
			}
		}
		if (state == TapeState.HEADER) {
			try {
				return pulseData.nextPulseWidth();
			} catch (ex) {
				if (!(ex instanceof EOFException )) throw ex;

				state = TapeState.HEADER_END_OF_DATA;
				console.log(state);
				count = 3;
			}
		}
		if (state == TapeState.HEADER_END_OF_DATA) {
			state = TapeState.PILOT_HEADER_END;
			console.log(state);
			count = 0x4F;
		}
		if (state == TapeState.PILOT_HEADER_END) {
			if (--count == 0) {
				state = TapeState.SYNC_HEADER_REPEAT;
				console.log(state);
				pulseDataSync.reset(true);
			} else
				return Config.S;
		}
		if (state == TapeState.SYNC_HEADER_REPEAT) {
			try {
				return pulseDataSync.nextPulseWidth();
			} catch (ex) {
				if (!(ex instanceof EOFException )) throw ex;
				state = TapeState.HEADER_REPEAT;
				console.log(state);
				pulseData.reset();
				bitData.setData(data, currentOffset, HEADER_SIZE);
				currentOffset += HEADER_SIZE;
			}
		}
		if (state == TapeState.HEADER_REPEAT) {
			try {
				return pulseData.nextPulseWidth();
			} catch (ex) {
				if (!(ex instanceof EOFException )) throw ex;
				state = TapeState.HEADER_REPEAT_END_OF_DATA;
				console.log(state);
				count = 3;
			}
		}
		if (state == TapeState.HEADER_REPEAT_END_OF_DATA) {
			state = TapeState.PILOT_HEADER_TRAILER;
			console.log(state);
			count = 0x4E;
		}
		if (state == TapeState.PILOT_HEADER_TRAILER) {
			if (--count == 0) {
				state = TapeState.SILENCE;
				console.log(state);
				count = 400000;
			}
			return Config.S;
		}
		if (state == TapeState.SILENCE) {
			if (--count == 0) {
				state = TapeState.PILOT_DATA;
				console.log(state);
				count = 0x1A00;
			}
			return 0;
		}
		if (state == TapeState.PILOT_DATA) {
			if (--count == 0) {
				state = TapeState.SYNC_DATA;
				console.log(state);
				pulseDataSync.reset(false);
			}
			return Config.S;
		}
		if (state == TapeState.SYNC_DATA) {
			try {
				return pulseDataSync.nextPulseWidth();
			} catch (ex) {
				if (!(ex instanceof EOFException )) throw ex;
				state = TapeState.DATA;
				console.log(state);
				pulseData.reset();
				console.log("data currentOffset = "
						+ currentOffset.toString(16));
				bitData.setData(data, currentOffset, dataSize);
			}
		}
		if (state == TapeState.DATA) {
			try {
				return pulseData.nextPulseWidth();
			} catch (ex) {
				if (!(ex instanceof EOFException )) throw ex;
				state = TapeState.DATA_END_OF_DATA;
				console.log(state);
				count = 3;
			}
		}
		if (state == TapeState.DATA_END_OF_DATA) {
			state = TapeState.PILOT_DATA_END;
			console.log(state);
			count = 0x4F;
		}
		if (state == TapeState.PILOT_DATA_END) {
			if (--count == 0) {
				state = TapeState.PILOT_DATA_TRAILER;
				console.log(state);
				count = 0x4E;
			}
			return Config.S;
		}
		if (state == TapeState.PILOT_DATA_TRAILER) {
			if (--count == 0) {
				state = TapeState.SYNC_DATA_REPEAT;
				console.log(state);
				pulseDataSync.reset(true);
			}
			return Config.S;
		}
		if (state == TapeState.SYNC_DATA_REPEAT) {
			try {
				return pulseDataSync.nextPulseWidth();
			} catch (ex) {
				if (!(ex instanceof EOFException )) throw ex;
				state = TapeState.DATA_REPEAT;
				console.log(state);
				pulseData.reset();
				bitData.setData(data, currentOffset, dataSize);
				currentOffset += dataSize;
			}
		}
		if (state == TapeState.DATA_REPEAT) {
			try {
				return pulseData.nextPulseWidth();
			} catch (ex) {
				if (!(ex instanceof EOFException )) throw ex;
				state = TapeState.DATA_REPEAT_END_OF_DATA;
				console.log(state);
			}
		}
		if (state == TapeState.DATA_REPEAT_END_OF_DATA) {
			if (currentOffset == data.length) {
				state = TapeState.END_TAPE;
				console.log(state);
			} else {
				console.log("next file: "
						+ currentOffset.toString(16) + "/"
						+ data.length.toString(16));
				state = TapeState.PILOT_HEADER;
				console.log(state);
				count = 0x1000;
			}
			return 0;
		}
		if (state == TapeState.END_TAPE) {
			return -1;
		}

		throw new RuntimeException("CsmFile::nextPulseWidth INVALID STATE");
	}
	
		// ============================================================
	// Constructors
	// ============================================================

	/**
	 * Constructor.
	 * 
	 * @param filepath
	 *            File path to CSM file.
	 */
	// CsmFile(String filepath) {

		/*try {
			File f = new File(filepath);
			int size = (int) f.length();
			data = new byte[size];
			int b;
			FileInputStream fis = new FileInputStream(f);
			int cnt = 0;
			while ((b = fis.read()) != -1) {
				data[cnt++] = (byte) b;
			}
			fis.close();
		} catch (IOException ex) {
			EventMessage.showError("Tape failed to load due to:\n"
					+ ex.getMessage());
		}*/

		this.rewind();
	//}
}