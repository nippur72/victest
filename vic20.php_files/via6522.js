/**
 * Copyright (c) 2010, matsondawson@gmail.com
 */

/**
 * Base implementation of a 6522 VIA.
 */
function Via6522(startAddress,vianame) {

	// ============================================================
	// Static Attributes
	// ============================================================

	console.log("Init VIA at "+startAddress.toString(16));
	
	var ORA = 1;
	var DDRA = 3;
	var SR = 10;
	
	var t1c, t1l, t2l_l, t2c;

	var reg = new Array(16);
	var hasPreCycled = false;
	var inhibitT1Interrupt, inhibitT2Interrupt, acrTimedCountdown;
	var ca2, lastca1, cb1, cb2;
	
	// ============================================================
	// Methods
	// ============================================================
	
	/**
	 * Reset the VIAs state.
	 */
	this.reset = function() {
		console.log("Vic reset");
	
		for(var i=0;i<reg.length;i++) reg[i]=0;
		for(var i=4;i<10; i++) reg[i]=0xFF;
		t1l = t1c = t2c = 0xFFFF;
		t2l_l = 0xFF;
		
		inhibitT1Interrupt = inhibitT2Interrupt = true;
		
		this.pins_ira = 0;
		this.pins_irb  = 0;
		this.ca1 = true;
		this.lastca1 = true;
		ca2 = true;
		newca1 = true;
		newca2 = true;
		cb1 = false;
		cb2 = false;
		acrTimedCountdown = true;
		this.hasInterrupt = 0;
		
		hasPreCycled=false;
	};
	
	/**
	 * Append debug information to element
	 */
	this.debugInformation = function() {
		var html="";
		html+="<table id='debug'>";
		html+="<tr><th colspan='2'>"+vianame+"("+startAddress.toString(16)+")</th></tr>";
		html+="<tr><td>ORB:</td><td>"+toBin8(this.invisibleRead(0))+"</td></tr>";
		html+="<tr><td>ORA:</td><td>"+toBin8(this.invisibleRead(1))+"</td></tr>";
		html+="<tr><td>DDRB:</td><td>"+toBin8(this.invisibleRead(2))+"</td></tr>";
		html+="<tr><td>DDRB:</td><td>"+toBin8(this.invisibleRead(3))+"</td></tr>";
		html+="<tr><td>T1C:</td><td>"+toHex4(t1c)+"</td></tr>";
		html+="<tr><td>T1L:</td><td>"+toHex4(t1l)+"</td></tr>";
		html+="<tr><td>T2C:</td><td>"+toHex4(t2c)+"</td></tr>";
		html+="<tr><td>T2L:</td><td>"+toHex2(t2l_l)+"</td></tr>";
		html+="<tr><td>SR:</td><td>"+toHex2(this.invisibleRead(10))+"</td></tr>";
		var reg11 = this.invisibleRead(11);
		var t1control = ["Timed Int.","Cont. Int", "Timed Int. + PB7 One shot","Cont. Int. + PB7 Square wave"];
		var t2control = ["Timed Int.","Count Down PB6"];
		var srControl = ["Disabled ","Shift in T2","Shift in PHI2","Shift in ext. clock",
			"Shift out free run T2", "Shift out T2", "Shift out PHI2", "Shift out ext. clock"];
		html+="<tr><td>ACR:</td><td>"+toBin8(this.invisibleRead(11))+"</td></tr>";
		html+="<tr><td>ACR-T1 Control:</td><td>"+t1control[reg11>>6]+"</td></tr>";
		html+="<tr><td>ACR-T2 Control:</td><td>"+t2control[(reg11>>5)&1]+"</td></tr>";
		html+="<tr><td>ACR-SR Control:</td><td>"+srControl[(reg11>>2)&7]+"</td></tr>";
		html+="<tr><td>ACR-PA Latch:</td><td>"+(((reg11>>1)&1)?"Yes":"No")+"</td></tr>";
		html+="<tr><td>ACR-PB Latch:</td><td>"+((reg11&1)?"Yes":"No")+"</td></tr>";
		
		var reg12 = this.invisibleRead(12);
		var cb2Control = reg12>>5;
		var cb1Control = (reg12>>4)&1;
		var ca2Control = (reg12>>1)&7;
		var ca1Control = reg12&1;
		var ca2andcb2Strings = ["Input-negative active edge",
							"Independent interrupt input-negative edge*",
							"Input-positive active edge",
							"Independent interrupt input-positive edge*",
							"Handshake output",
							"Pulse output",
							"Low output",
							"High output"];
		var ca1andcb1Strings = ["Interrupt -ve edge","Interrupt +ve edge"];
		html+="<tr><td>PCR:</td><td>"+toHex2(reg12)+"</td></tr>";
		html+="<tr><td>PCR-CB1:</td><td>"+ca1andcb1Strings[cb1Control]+"</td></tr>";
		html+="<tr><td>PCR-CB2:</td><td>"+ca2andcb2Strings[cb2Control]+"</td></tr>";
		html+="<tr><td>PCR-CA1:</td><td>"+ca1andcb1Strings[ca1Control]+"</td></tr>";
		html+="<tr><td>PCR-CA2:</td><td>"+ca2andcb2Strings[ca2Control]+"</td></tr>";
		html+="<tr><td>IFR:</td><td>"+toBin8(this.invisibleRead(13))+"</td></tr>";
		html+="<tr><td>IER:</td><td>"+toBin8(this.invisibleRead(14))+"</td></tr>";
		
		html+="</table>";
		return html;
	}
	
	/**
	 * Handle a clock cycle on the VIA.
	 */
	this.cycleUp = function() {
		// raise interrupts
		if (t1c==-1) {
			if (!inhibitT1Interrupt) {
				reg[13  /*IFR*/] |= 0x40; // Set interrupt flag
				inhibitT1Interrupt = true;
			}
		}
		
		if (t2c==-1) {
			if (acrTimedCountdown && !inhibitT2Interrupt) {
				reg[13  /*IFR*/] |= 0x20; // Set interrupt flag
				inhibitT2Interrupt = true;
			}
		}
		
		if (reg[12] & 1) {
			if (this.ca1!=this.lastca1) {
			console.debug(this.ca1);
				this.lastca1=this.ca1;
				if (this.ca1) {
					reg[13] |= 2;
				}
			}
		}
		
		this.hasInterrupt = reg[14  /*IER*/] & reg[13  /*IFR*/] & 0x7F;
	};
	
	this.cycleDown = function() {
		if (hasPreCycled) {
			hasPreCycled=false;
			return;
		}
		if (t1c--==-1) {
			// continuous interrupt
			if (reg[11 /*ACR*/] & 0x40) {
				t1c = t1l;
				inhibitT1Interrupt = false;
			}
			// one-shot
			else {
				t1c = 0xFFFE;
			}
		}
		
		if (t2c--==-1) {
			t2c = 0xFFFE;
		}
		
		if ((~reg[12]) & 1) {
			if (this.ca1!=this.lastca1) {
				this.lastca1=this.ca1;
				if (!this.ca1) {
					reg[13] |= 2; // IFR
				}
			}
		}
	};
	
	this.read = function(regnum) {
		regnum &= 0xF;
		//console.debug(vianame,"r",regnum);
		
		switch (regnum) {
		case 0 /*IRB*/: {
			var ddrb = reg[2  /*DDRB*/]; // 0 in 2  /*DDRB*/ is input
			var pins_in = (~this.pins_irb) & (~ddrb);
			var reg_in = reg[0  /*ORB*/] & ddrb;
			return (pins_in | reg_in) & 0xFF;
		}
		// Read of input register A, depends wholly on what's going on on the
		// pins
		case 1 /*IRA*/:
			// Clear ca1,ca2 interrupt flags, only if not "independent"
			var ic = (reg[12  /*PCR*/] >> 1) & 7;
			reg[13  /*IFR*/] &= (ic != 1 && ic != 3) ? ~3 : ~1;
		case 15 /*IRA_nohs*/:
		
			// TODO why was this here?
			//if (this==vic20.via2) return (~this.pins_ira) & (~reg[DDRA]) & 0xFE;
			return (~this.pins_ira) & (~reg[DDRA]) & 0xFF; // 0 in DDRA is input //
			// Might need to remove
			// data direction reg
			// 0 /*IRB*/ works differently, it will read what's on the pins for
			// inputs, but what's in the register for outputs
		case 4/*T1C_L*/: {
			// reset interrupt flag
			reg[13  /*IFR*/] &= ~0x40;
			inhibitT1Interrupt = false;
			return t1c&0xFF;
			// return reg[regnum];
		}
		case 5/*T1C_H*/: {
			return (t1c>>8)&0xFF;
		}
		case 6/*T1L_L*/: {
			return t1l&0xFF;
		}
		case 7/*T1L_H*/: {
			return (t1l>>8)&0xFF;
		}
		case 8 /* T2C_L */: {
			// reset interrupt flag
			reg[13  /*IFR*/] &= ~0x20;
			inhibitT2Interrupt = false;
			return t2c & 0xFF;
			// return reg[regnum];
		}
		case 9 /* T2C_H */: {
			return (t2c>>8)&0xFF;
		}
		// Interrupt flag register
		case 13  /*IFR*/: {
			var result = reg[13  /*IFR*/] & 0x7F;
			// If any flag set top bit must be set
			return result?(result|0x80):result;
		}
		case 14  /*IER*/:
			// interrupt enable register
			return reg[14  /*IER*/] | 0x80;
		default:
			return reg[regnum];
		}
	};

	// TODO remove this, it is used by the keyboard update function
	this.getReg = function(regnum) {
		return reg[regnum];
	};
	
	this.invisibleRead = function(regnum) {
		regnum&=15;
		switch(regnum) {
			case 4/*T1C_L*/: {
				return t1c&0xFF;
			}
			case 5/*T1C_H*/: {
				return (t1c>>8)&0xFF;
			}
			case 6/*T1L_L*/: {
				return t1l&0xFF;
			}
			case 7/*T1L_H*/: {
				return (t1l>>8)&0xFF;
			}
			case 8 /* T2C_L */: {
				return t2c & 0xFF;
				// return reg[regnum];
			}
			case 9 /* T2C_H */: {
				return (t2c>>8)&0xFF;
			}
			case 15 /* T2C_H */: {
				return reg[1];
			}
			default:
				return reg[regnum];
		}
	}
	
	/**
	 * {@inheritDoc}
	 * 
	 * TODO Writes aren't latched immediately?
	 */
	this.write = function(regnum, value) {
	//console.debug(vianame,"w",regnum&15,value);
		this.cycleDown();
		hasPreCycled=true;
		
		switch(regnum&15) {
		// ORB
		case 0: reg[0] = value; break;
		//var ORA = 1;
		//var 1 /*IRA*/ = 1;
		case 1:
			var ic = (reg[12  /*PCR*/] >> 1) & 7;
			reg[13  /*IFR*/] &= (ic != 1 && ic != 3) ? ~3 : ~1;
		case 15:
			reg[ORA] = value;
			break;
		
		case 2: reg[2] = value; break;
		case 3: reg[3] = value; break;
		
		// var 4/*T1C_L*/ = 4;
		case 4:
			t1l = (t1l&~0xFF) | value;
			// reg[6  /*T1L_L*/] = value;
			break;
		// var 5 /*T1C_H*/ = 5;
		case 5:
			value<<=8;
			t1l = (t1l&0xFF)|value;
			t1c = t1l;
			//reg[7  /*T1L_H*/] = reg[5 /*T1C_H*/] = value;
			// reg[4/*T1C_L*/] = reg[6  /*T1L_L*/];
			// reset interrupt flag
			reg[13  /*IFR*/] &= ~0x40; // flag not to be reset until next cycle?
			inhibitT1Interrupt = false;
			break;
		// T1L_L
		case 6:
			t1l = (t1l&0xFF00) | value;
			break;
		// var 7  /*T1L_H*/ = 7;
		case 7:
			value<<=8;
			t1l = (t1l&0xFF)|value;
			// reg[7  /*T1L_H*/] = value;
			reg[13  /*IFR*/] &= ~0x40; // flag not to be reset until next cycle?
			break;
		// var 8 /* T2C_L */ = 8;
		case 8:
			t2l_l = value;
			break;
			
		// var 9  /*T2C_H*/ = 9;
		case 9:
			t2c = (value<<8) | t2l_l;
			//reg[9 /*T2C_H*/] = value;
			//reg[8 /* T2C_L */] = t2l_l;
			// reset interrupt flag
			reg[13  /*IFR*/] &= ~0x20;
			inhibitT2Interrupt = false;
			break;
		
		case 10: reg[10] = value; break;
		case 11: reg[11] = value; acrTimedCountdown = (reg[11 /*ACR*/] & 0x20)==0; break;
		case 12: reg[12] = value; break;
		
		// var 13  /*IFR*/ = 13;
		case 13:
			reg[13  /*IFR*/] &= ~value;
			break;
		
		// var 14  /*IER*/ = 14;
		case 14:
			if (value & 0x80) {
				reg[14  /*IER*/] |= value;
			} else {
				reg[14  /*IER*/] &= ~value;
			}
			break;
		// var 15 /*ORA_nohs*/ = 15;
		// var 15 /*IRA_nohs*/ = 15;
		default:
			reg[1 /*ORA*/] = value;
			break;
		}
	}

	this.reset();
}
