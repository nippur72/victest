// **********************************
// Constants
// **********************************

function Cpu6502(memory,resetSource,irqSource,nmiSource) {
	var N = 1 << 7, V = 1 << 6, R = 1 << 5, B = 1 << 4,
	D = 1 << 3, I = 1 << 2, Z = 1 << 1, C = 1;
	var _N = ~N, _C = ~C, _I = ~I;
	var NZ = N|Z, NC = N|C, NV = N|V, NCZ = NZ|C, NCZV = NCZ | V, NVZ = N|V|Z;
	var _NZ = ~NZ, _NC = ~NC, _NV=~NV, _NCZ = ~NCZ, _NCZV = ~NCZV, _NVZ = ~NVZ;
	
	// **********************************
	// CPU Registers
	// **********************************
	var pc, sp, a, x, y, p, np;

	this.getRegisters = function() {
		return {
			"pc": pc,
			"sp": sp,
			"a": a,
			"x": x,
			"y": y,
			"p": p
		};
	}
	
	this.setA = function(_a) { a = parseInt(_a,16); }
	this.setX = function(_x) { x = parseInt(_x,16); }
	this.setY = function(_y) { y = parseInt(_y,16); }
	
	this.toggle = function(value) {
		p ^= value;
		debug();
	}
	
	function genTogglePBit(bit) {
		return "<a href='javascript:vic20.cpu.toggle("+bit+");'>";
	}
	
	/**
	 * Append debug information to element
	 */
	this.debugInformation = function() {
		var regs = vic20.cpu.getRegisters();
		
		var html = "<div id='cpuregs'>";
		html+="<b>CPU Registers</b><br/>";
		html+="<table id='debug'><tr><th>PC</th><th>A</th><th>X</th><th>Y</th><th>P</th></tr>";
		html+="<tr><td>"+regs.pc.toString(16).toUpperCase()+"</td>";
		html+="<td><input type='text' style='width:20px;text-align:right' value='"+regs.a.toString(16).toUpperCase()+"' onchange='vic20.cpu.setA(this.value)'/></td>";
		html+="<td><input type='text' style='width:20px;text-align:right' value='"+regs.x.toString(16).toUpperCase()+"' onchange='vic20.cpu.setX(this.value)'/></td>";
		html+="<td><input type='text' style='width:20px;text-align:right' value='"+regs.y.toString(16).toUpperCase()+"' onchange='vic20.cpu.setY(this.value)'/></td>";
		html+="<td>";
		html+=genTogglePBit(N)+((regs.p&(1<<7))?"N":"n")+"</a> ";
		html+=genTogglePBit(V)+((regs.p&(1<<6))?"V":"v")+"</a> ";
		// html+=(regs.p&(1<<5))?"R":"r";
		html+=genTogglePBit(B)+((regs.p&(1<<4))?"B":"b")+"</a> ";
		html+=genTogglePBit(D)+((regs.p&(1<<3))?"D":"d")+"</a> ";
		html+=genTogglePBit(I)+((regs.p&(1<<2))?"I":"i")+"</a> ";
		html+=genTogglePBit(Z)+((regs.p&(1<<1))?"Z":"z")+"</a> ";
		html+=genTogglePBit(C)+((regs.p&(1<<0))?"C":"c")+"</a> ";

		html+="</td></tr>";
		html+="</table>";
		html+="</div>";
		
		return html;
	}
	
	var currentInst;
	var currentInstOffset;
	var instruction;
	var b, offset;
	var prevNmi = 0;

	var irqBits = 0;
	var nmiBits = 0;

	function push(value) {
		memory.write(0x100 + sp, value);
		sp = (sp - 1) & 0xFF;
	}

	function pop() {
		sp = (sp + 1) & 0xFF;
		return memory.read(0x100 + sp);
	}

	function nz(value) {
		p = value
			? ((p & _NZ) | (value & N))
			: ((p & _N) | Z);
	}

	function nzc(reg, value) {
		p &= ~(Z | C | N);
		reg -= value;
		p = ((reg == 0) ? ((p & ~N) | Z) : (p & ~(N | Z) | (reg & N)));
		if (reg >= 0) {
			p |= C;
		}
		/*
		reg -= value;
		p = reg
			? ((p & _NCZ) | (reg & N))
			: ((p & _NC) | Z);
		if (reg >= 0) p |= C;*/
	}

	this.getPc = function() {
		return pc;
	}
	
	var colour = 1;
	
	this.incColour = function() {
		colour <<= 1;
	}
	
	function nextInst() {
		if ((nmiBits&4) ^ prevNmi) {
			prevNmi = (nmiBits&4);
			if (prevNmi) {
				currentInst = INST_NMI;
				currentInstOffset = 0;
			}
		}

		if (currentInstOffset!=0) {
			// Is interrupt and interrupts enabled?
			if (irqBits&2) {
				currentInst = INST_IRQ;
			} else {
				// Get next instruction
				instruction = memory.read(pc);
				currentInst = instfunc[instruction];
				/******* Following line is the only difference between debug and nodebug versions ****/
				memExec[pc] = 2 | (p&I);
				// memColour[pc] |= colour;
				pc = (pc + 1) & 0xFFFF;
			}
			currentInstOffset = 0;
		}
		
		if (np!=null) {
			p=np;
			np=null;
		}
	}

	function badInst() {
		alert("Bad instruction pc=$" + pc.toString(16) + " instruction = $" + instruction.toString(16));
		resetSource.reset();
	}

	function jamInst() {
		alert("Jam instruction pc=$" + pc.toString(16) + " instruction = $" + instruction.toString(16));
		resetSource.reset();
	}

	function halt() {
		exit();
	}

	// DONE
	function nullOp() {};

	// DONE
	function pcNull() {
		// ??
		pc = (pc+1)&0xFFFF;
	};

	// DONE
	function pushA() {
		push(a);
	};

	// DONE
	function pushP() {
		push(p);
	};

	// DONE
	function pushPcH() {
		push(pc >> 8);
	};

	// DONE
	function pushPcL() {
		push(pc & 0xFF);
	};

	// DONE
	function pushPorBsetI() {
		// 5 | 0,S-2 | P | W
		push(p | B);
		p |= I;
	};

	// DONE
	function pushPsetI() {
		// 5 | 0,S-2 | P | W
		push(p);
		p |= I;
	};

	// DONE
	function plp() {
		p = (pop()&~B) | R;
	};

	// DONE
	function pla() {
		nz(a = pop());
	};

	// DONE
	function popPcL() {
		pc = pop();
	};

	// DONE
	function popPcH() {
		pc |= (pop() << 8);
	};

	// DONE
	function popPcHaddOne() {
		pc = ((pop() << 8) | pc) + 1;
		pc &= 0xFFFF;
	};

	// DONE
	function loadPCResetL() {
		pc = memory.read(0xFFFC);
	};

	// DONE
	function loadPCResetH() {
		pc |= memory.read(0xFFFD) << 8;
	};

	// DONE
	function loadPCInterruptL() {
		pc = memory.read(0xFFFE);
	};

	// DONE
	function loadPCInterruptH() {
		pc |= memory.read(0xFFFF) << 8;
	};
	
	function loadPCNmiL() {
		pc = memory.read(0xFFFA);
	};

	// DONE
	function loadPCNmiH() {
		pc |= memory.read(0xFFFB) << 8;
	};

	// !
	function zp_x_from_pc() {
		offset = (memory.read(pc) + x) & 0xFF;
		pc = (pc + 1) & 0xFFFF;
	};

	// !
	function load_offset_zp_l() {
		b = memory.read(offset++);
	};

	// !
	function load_offset_zp_h() {
		offset = b | (memory.read(offset & 0xFF) << 8);
	};

	// DONE
	function load_offset_zp_h_plus_y() {
		offset = ((b | (memory.read(offset & 0xFF) << 8)) + y)&0xFFFF;
		if ((offset & 0xFF) >= y) {
			// skip cycle if same page
			currentInstOffset++;
		}
	};

	// DONE
	function op_offset() {
		b = memory.read(offset);
		op[instruction]();
	};

	// DONE
	function op_offset_rmw() {
		b = memory.read(offset);
	};

	// DONE
	function op_offset_w() {
		op[instruction]();
		memory.write(offset, b);
	};

	// DONE
	function zp_from_pc() {
		offset = memory.read(pc);
		pc = (pc + 1) & 0xFFFF;
	};

	// DONE
	function pc_from_zp_and_pc() {
		pc = (memory.read(pc) << 8) | offset;
	};

	// DONE
	function offset_plus_y() {
		offset = (offset + y) & 0xFFFF;
		if ((offset & 0xFF) >= y) {
			// skip cycle if same page, by calling next instruction directly
			currentInst[currentInstOffset++]();
		}
	};

	// DONE
	function offset_plus_x() {
		offset = (offset + x) & 0xFFFF;
		if ((offset & 0xFF) >= x) {
			// skip cycle if same page, by calling next instruction directly
			currentInst[currentInstOffset++]();
		}
	};

	// DONE
	function offset_plus_x_w() {
		offset = (offset + x) & 0xFFFF;
	};

	function offset_plus_y_w() {
		offset = (offset + y) & 0xFFFF;
	}

	function b_offset_cond_from_pc() {
		var diff = memory.read(pc);
		if (diff>127) diff=diff-256;

		var pp = ((instruction & 0x20) != 0) ? (p ^ 0xFF) : p;
		var mask = ((Z << 24) | (C << 16) | (V << 8) | N) >>> ((instruction >> 6) << 3);
		if ((pp & mask) != 0) {
			pc++;
			// Skip branch
			irqBits = 0;
			currentInstOffset += 2;
		} else {
			// Take branch
			offset = (pc + (diff) + 1);
		}
	}

	function bra_diff_page() {
		if (((offset ^ pc) >> 8) == 0) {
			currentInstOffset++; // skip extra cycle
		}
		pc = offset;
	};

	// DONE
	function logic_imm() {
		b = memory.read(pc);
		pc = (pc + 1) & 0xFFFF;
		op[instruction]();
	};
	
	function logic_imm_sbx() {
		x = (x&a) - memory.read(pc);
		if (x<0) p &= ~C; else p |= C;
		nz(x &= 0xFF);
		
		pc = (pc + 1) & 0xFFFF;
	};

	// DONE
	function logic_zp() {
		b = memory.read(offset);
		op[instruction]();
	};
	
	function nullread_offset() {
		memory.read(offset);
	};

	// DONE
	function logic_zp_w() {
		op[instruction]();
		memory.write(offset, b);
	};

	// DONE
	function zp_y_from_pc() {
		offset = (memory.read(pc) + y) & 0xFF;
		pc = (pc + 1) & 0xFFFF;
	};

	// DONE
	function temp_to_zp() {
		memory.write(offset, b);
	};

	// DONE
	function clc() {
		p &= _C;
	};

	// DONE
	function sec() {
		p |= C;
	};

	// DONE
	function cli() {
		// p &= ~I;
		np = p & _I;
	};

	// DONE
	function sei() {
		np = p | I;
		// p |= I;
	};

	// DONE
	function clv() {
		p &= ~V;
	};

	// DONE
	function cld() {
		p &= ~D;
	};

	// DONE
	function sed() {
		p |= D;
	};

	// DONE
	function dey() {
		nz(y = (y - 1) & 0xFF);
	};

	// DONE
	function dex() {
		nz(x = (x - 1) & 0xFF);
	};

	// DONE
	function iny() {
		nz(y = (y + 1) & 0xFF);
	};

	// DONE
	function inx() {
		nz(x = (x + 1) & 0xFF);
	};

	// DONE
	function tya() {
		nz(a = y);
	};

	// DONE
	function tay() {
		nz(y = a);
	};

	// DONE
	function txa() {
		nz(a = x);
	};

	// DONE
	function tax() {
		nz(x = a);
	};

	// DONE
	function txs() {
		sp = x;
	};

	// DONE
	function tsx() {
		nz(x = sp);
	};

	// DONE
	function load_offset_abs_l() {
		offset = memory.read(pc);
		pc = (pc + 1) & 0xFFFF;
	};

	// DONE
	function load_offset_abs_h() {
		offset |= (memory.read(pc) << 8);
		pc = (pc + 1) & 0xFFFF;
	};

	function op_offset_plus_x() {
		offset = (offset+x)&0xFFFF;
		if ((offset & 0xFF) >= x) {
			b = memory.read(offset);
			op[instruction]();
			// skip cycle as same page
			currentInstOffset++;
		}
	}

	function op_offset_plus_y() {
		offset = (offset+y)&0xFFFF;
		if ((offset & 0xFF) >= y) {
			b = memory.read(offset);
			op[instruction]();
			// skip cycle as same page
			currentInstOffset++;
		}
	}

	function load_offset_abs_h_plus_y() {
		offset = (offset|(memory.read(pc) << 8)) + y;
		pc = (pc + 1) & 0xFFFF;
		if ((offset & 0xFF) >= y) {
			// skip cycle if same page, by calling next instruction directly
			currentInstOffset++;
		}
	}

	// DONE
	function opa() {
		b = a;
		op[instruction]();
		a = b;
	};

	// DONE
	function load_pc_abs_l() {
		b = memory.read(pc);
		pc = (pc + 1) & 0xFFFF;
	};

	// DONE
	function load_pc_abs_h() {
		pc = (memory.read(pc) << 8) | b;
	};

	// DONE
	function load_pc_offset_l() {
		pc = memory.read(offset++);
		if ((offset & 0xFF) == 0) {
			offset -= 0x100;
		}
		offset &= 0xFFFF;
	};

	function load_pc_offset_h() {
		pc |= (memory.read(offset++) << 8);
	}

	function temp_to_offset() {
		memory.write(offset, b);
	}

	function nullProc() {
		// nothing
	}

	function ora() {
		nz(a |= b);
	}

	function sre() {
		if (b & C) {
			p |= C;
		} else {
			p &= ~C;
		}

		b >>= 1;
		nz(a ^= b);
	}

	function rra() {
		// {adr}:={adr}ror A:=A adc {adr}
		ror();
		adc();
	}

	function rla() {
		// {adr}:={adr}rol A:=A and {adr}
		var oldCarry = p & C;
		p &= ~C;
		p |= (b >> 7);
		b = (b << 1) | oldCarry;
		b &= 0xFF;

		nz(a &= b);
	}

	function slo() {
		// {adr}:={adr}*2 A:=A or {adr}
		if ((b & N) != 0) {
			p |= C;
		} else {
			p &= ~C;
		}

		b = (b << 1) & 0xFF;
		nz(a |= b);
	}

	function and() {
		nz(a &= b);
	}

	function eor() {
		nz(a ^= b);
	}

	function adc() {
		// decimal mode

		/*if (p & D) {
			var sum = (a & 0xF) + (b & 0xF) + (p & C);
			p &= _NCZV;
			if (sum > 0x09) sum += 0x06;
			if (sum > 0x1F) sum -= 0x10;

			sum += (a & 0xF0) + (b & 0xF0);
			p |= (sum & N);
			p |= ((~(a ^ b) & (a ^ sum)) & N) >> 1; // Overflow
			a = sum & 0xFF;
			if (a == 0) p |= Z;

			if (sum >= 0xA0) {
				a += 0x60;
				a &= 0xFF;
				p |= C;
			}
		} else {
			var sum2 = a + b + (p & C);
			p &= _NCZV;

			p |= ((~(a ^ b) & (a ^ sum2)) & N) >> 1; // Overflow
			p |= ((sum2 >> 8) & C);
			a = sum2 & 0xFF;
			if (a == 0) {
				p |= Z;
			}
			p |= (a & N);
		}*/
		if ((p & D) != 0) {
				var sum = (a & 0xF) + (b & 0xF) + (p & C);
				p &= ~(N | Z | C | V);
				if (sum > 0x09) {
					sum += 0x06;
				}
				if (sum > 0x1F) {
					sum -= 0x10;
				}

				sum += (a & 0xF0) + (b & 0xF0);
				p |= (sum & N);
				p |= ((~(a ^ b) & (a ^ sum)) & N) >> 1; // Overflow
				a = (sum & 0xFF);
				if (a == 0) {
					p |= Z;
				}
				if (sum >= 0xA0) {
					a += 0x60;
					a &= 0xFF;
					p |= C;
				}
			} else {
				var sum2 = a + b + (p & C);
				p &= ~(N | Z | C | V);

				p |= ((~(a ^ b) & (a ^ sum2)) & N) >> 1; // Overflow
				p |= ((sum2 >> 8) & C);
				a =(sum2 & 0xFF);
				if (a == 0) {
					p |= Z;
				}
				p |= (a & N);
			}
	}

	function sbc() {
		/*
		if (p & D) {
			var sumadd = 0, sum = (a & 0xF) - (b & 0xF) - (~p & C);
			p &= _NCZV;

			if (sum < -10) sumadd = 10;
			else if (sum < 0) sumadd = -6;

			sum += (a & 0xF0) - (b & 0xF0);
			if ((sum & 0xFF) == 0) {
				p |= Z;
			}
			p |= (sum & N) | (((a ^ b) & (a ^ sum)) & N) >> 1;
			sum += sumadd;
			if (sum < 0) {
				sum += 0xA0;
			} else {
				if (sum >= 0xA0) sum -= 0x60;
				p |= C;
			}

			a = sum & 0xFF;
		} else {
			var sum2 = a - b - (~p & C);
			p &= _NCZV;
			p |= (((a ^ b) & (a ^ sum2)) & N) >> 1; // Overflow
			a = sum2 & 0xFF;
			p |= (((~sum2) >> 8) & C) | (a & N); // Negative
			if (a == 0) p |= Z; // Zero
		}*/
		if ((p & D) != 0) {
			var sumadd = 0, sum = (a & 0xF) - (b & 0xF) - (~p & C);
			p &= ~(N | Z | C | V);

			if (sum < -10) {
				sumadd = 10;
			} else if (sum < 0) {
				sumadd = -6;
			}

			sum += (a & 0xF0) - (b & 0xF0);
			if ((sum & 0xFF) == 0) {
				p |= Z;
			}
			p |= (sum & N);
			p |= (((a ^ b) & (a ^ sum)) & N) >> 1;
			sum += sumadd;
			if (sum < 0) {
				sum += 0xA0;
			} else {
				if (sum >= 0xA0) {
					sum -= 0x60;
				}
				p |= C;
			}

			a = (sum & 0xFF);
		} else {
			var sum2 = a - b - (~p & C);
			p &= ~(N | Z | C | V);
			p |= (((a ^ b) & (a ^ sum2)) & N) >> 1; // Overflow
			a =  (sum2 & 0xFF);
			p |= ((~sum2 >> 8) & C); // Carry
			p |= (a & N); // Negative
			if (a == 0) {
				p |= Z; // Zero
			}
		}
	}

	function cmp() {
		nzc(a, b);
	}

	function cpx() {
		nzc(x, b);
	};

	function cpy() {
		nzc(y, b);
	}

	function bit() {
		p &= _NVZ;
		if ((a & b) == 0) p |= Z;
		p |= (b & NV);
	}

	// DONE
	function lda() {
		nz(a = b);
	}

	// DONE
	function ldx() {
		nz(x = b);
	}

	// DONE
	function ldy() {
		nz(y = b);
	}

	// DONE
	function sta() {
		b = a;
	}

	// DONE
	function sax() {
		b = a & x;
	}

	// DONE
	function stx() {
		b = x;
	}

	// DONE
	function sty() {
		b = y;
	}

	// DONE
	function asl() {
		p &= ~C;
		p |= (b >> 7);
		nz(b = (b << 1) & 0xFF);
	}

	// DONE
	function rol() {
		var oldCarry = p & C;
		p &= ~C;
		p |= (b >> 7);
		nz(b = ((b << 1) | oldCarry) & 0xFF);
	}

	// DONE
	function lsr() {
		p &= ~(C | NZ);
		p |= (b & C);
		// Shift right & set flags
		if ((b >>= 1) == 0) {
			p |= Z;
		}
	}

	// DONE
	function ror() {
		var newN = (p & C) << 7;
		// Set new carry
		p &= ~(C | NZ);
		// Set C flag
		p |= (b & C) | newN;
		// Set N flag
		b = ((b >> 1) | newN);
		if (b == 0) {
			p |= Z;
		}
	}

	// DONE
	function anc() {
		nz(a &= b);
		p &= ~C;
		p |= (a >> 7);
	}

	// DONE
	function ane() {
		a = (a | 0xEE) & x;
		nz(a &= b);
	}

	// DONE
	function lxa() {
		a = x = ((a|0xEE) & b);
		nz(a);
	}

	// DONE
	function arr() {
		and();
		ror();
		p &= ~(C | V);
		p |= (b >> 5) & C;
		p |= ((b << 2) | (b << 1)) & V;
	}

	// DONE
	function asr() {
		and();
		lsr();
	}

	// DONE
	function dec() {
		nz(b = (b - 1) & 0xFF);
	}

	// DONE
	function inc() {
		nz(b = (b + 1) & 0xFF);
	}


	// DONE
	function dcp() {
		dec();
		cmp();
	}

	// DONE
	function isb() {
		inc();
		sbc();
	}

	// DONE
	function lae() {
		a &= b;
		nz(x = a);
		sp = x;
	}

	// DONE
	function lax() {
		a = b;
		nz(x = a);
	}

	var INST_RESET = [nullOp, nullOp, loadPCResetL,
				loadPCResetH, nextInst];

	var INST_IRQ = [nullOp, nullOp, pushPcH, pushPcL, pushPsetI,
				loadPCInterruptL, loadPCInterruptH, nextInst ];

	var INST_NMI = [nullOp, nullOp, pushPcH, pushPcL, pushPsetI,
				loadPCNmiL, loadPCNmiH, nextInst];

	// >> DONE
	var INST_BAD = [badInst, halt];
	// >> DONE
	var INST_JAM = [jamInst, halt];

	/*
	 * BRK 2 | PBR,PC+1 | Signature | R 3 | 0,S | Program Counter High | W 4 |
	 * 0,S-1 | Program Counter Low | W 5 | 0,S-2 | (COP Latches)P | W 6 | 0,VA |
	 * Abs.Addr. Vector Low | R 7 | 0,VA+1 | Abs.Addr. Vector High | R
	 * >> DONE
	 */
	var BRK = [pcNull, pushPcH, pushPcL, pushPorBsetI,
				loadPCInterruptL, loadPCInterruptH, nextInst];

	/*
	 * e.g. ORA ($FF,x)
	 * OK
	 */
	 // FINE
	var INST_X_IND = [
		// 2 | PBR,PC+1   | Direct Offset         | R
		zp_x_from_pc,
		// 3 | PBR,PC+1   | Internal Operation    | R
		nullOp,
		// 4 | 0,D+DO+X   | Absolute Address Low  | R
		load_offset_zp_l,
		// 5 | 0,D+DO+X+1 | Absolute Address High | R
		load_offset_zp_h,
		// 6 | DBR,AA     | Data Low              | R/W
		op_offset,
		//
		nextInst];
	
	// ?
	var INST_X_IND_RMW = [ zp_x_from_pc, nullOp,
				load_offset_zp_l, load_offset_zp_h, op_offset_rmw, nullOp // TODO
				// this
				// should
				// be an
				// old
				// data
				// write
				, op_offset_w, nextInst ];
	
	// FINE
	var INST_X_IND_W = [
		// 2   |  PBR,PC+1        | Direct Offset         |    R
		zp_x_from_pc,
		// 3   |  PBR,PC+1        | Internal Operation    |    R
		nullOp,
		// 4   |  0,D+DO+X        | Absolute Address Low  |    R
		load_offset_zp_l,
		// 5   |  0,D+DO+X+1      | Absolute Address High |    R 
		load_offset_zp_h,
		// 6   |  DBR,AA          | Data Low              |   R/W
		op_offset_w,
		nextInst];

	/*
	 * DCP ($FF,x)
	 */
	var INST_X_IND_I = [
		// 2 | PBR,PC+1 | Direct Offset | R
		zp_x_from_pc,
		// 3 | PBR,PC+1 | Internal Operation | R
		nullOp,
		// 4 | 0,D+DO+X | Absolute Address Low | R
		load_offset_zp_l,
		// 5 | 0,D+DO+X+1 | Absolute Address High | R
		load_offset_zp_h,
		// 6 | DBR,AA | Data Low | R 
		op_offset,
		// 7 | DBR,AA | Old Data Low | W
		nullOp,
		// 8 | DBR,AA | New Data Low | W
		op_offset_w,
		nextInst];
	
	// Illegal instructions
	var INST_Y_IND_I = [zp_y_from_pc, nullOp,
				load_offset_zp_l, load_offset_zp_h, op_offset, nullOp, op_offset_w,
				nextInst];

	/*
	 * e.g. ORA ($FF),Y
	 */
	 // FINE
	var INST_IND_Y = [
		// 2 | PBR,PC+1 | Direct Offset | R
		zp_from_pc,
		// 3 | 0,D+DO | Absolute Address Low | R
		load_offset_zp_l,
		// 4 | 0,D+DO+1 | Absolute Address High | R
		load_offset_zp_h_plus_y,
		// 4a | DBR,AAH,AAL+YL | Internal Operation | R
		// Add 1 cycle for indexing across page boundaries, or write
		nullOp,
		// 5 | DBR,AA+Y | Data Low | R/W 
		op_offset,
		nextInst];
	
	// illegal instructions
	var INST_IND_Y_RMW = [zp_from_pc, load_offset_zp_l,
				load_offset_zp_h_plus_y, nullOp, op_offset_rmw, nullOp // TODO add
				// write
				// back old
				// data low
				, op_offset_w, nextInst ];
	
	/*
		STA (z), y
	*/
	var INST_IND_Y_W = [
		// 2   |  PBR,PC+1        | Direct Offset         |    R 
		zp_from_pc,
		// 3   |  0,D+DO          | Absolute Address Low  |    R
		load_offset_zp_l,
		// 4   |  0,D+DO+1        | Absolute Address High |    R
		load_offset_zp_h,
		// Add 1 cycle for indexing across page boundaries, or write
		// (4) 4a  |  DBR,AAH,AAL+YL  | Internal Operation    |    R   
		// This is specific to STA (z),y which is a write, so there will always be one extra cycle
		offset_plus_y_w,
		// 5   |  DBR,AA+Y        | Data Low              |   R/W
		op_offset_w, nextInst];

	/*
	 * BPL *-2 
	 * (5) Add 1 cycle if branch is taken.
	 * (6) Add 1 cycle if branch is taken across page boundaries 
	 */
	 // FINE
	var INST_BCOND = [
		// 2 | PBR,PC+1 | Offset | R (5) 
		b_offset_cond_from_pc,
		// (5) 2a | PBR,PC+2 | Internal Operation | R
		bra_diff_page,
		// (6) 2b | PBR,PC+2+OFF | Internal Operation | R
		nullOp, nextInst];

	/*
	 * JSR $FFFF 
	 */
	// FINE
	var INST_JSR = [
		// 2 | PBR,PC+1 | NEW PCL | R | 
		zp_from_pc,
		// 3 | 0,S | Internal Operation | R |
		nullOp,
		// 4 | 0,S | Program Counter High | W |
		pushPcH,
		// 5 | 0,S-1 | Program Counter Low | W
		pushPcL,
		// 6 | PBR,PC+2 | NEW PCH | R
		pc_from_zp_and_pc,
		nextInst];

	/*
	 * RTI 2 | PBR,PC+1 | Internal Operation | R | 3 | PBR,PC+1 | Internal
	 * Operation | R | 4 | 0,S+1 | Status Register | R | 5 | 0,S+2 | New PCL | R
	 * | 6 | 0,S+3 | New PCH | R |
	 */
	 // FINE
	var INST_RTI = [nullOp, nullOp, plp, popPcL, popPcH,
				nextInst];

	/*
	 * RTS 2 | PBR,PC+1 | Internal Operation | R 3 | PBR,PC+1 | Internal
	 * Operation | R 4 | 0,S+1 | New PCL-1 | R 5 | 0,S+2 | New PCH | R 6 | 0,S+2
	 * | Internal Operation | R
	 */
	// FINE
	var INST_RTS = [nullOp, nullOp, popPcL, popPcHaddOne,
				nullOp, nextInst];

	// FINE
	var INST_LOGIC_IMM = [logic_imm, nextInst];

	var INST_LOGIC_IMM_SBX = [logic_imm_sbx, nextInst];
	
	/*
	 * LDA $FF 2 | PBR,PC+1 | Direct Offset | R | 3 | 0,D+DO | Data Low | R/W |
	 */
	var INST_ZPG = [
	// 2   |  PBR,PC+1        | Direct Offset         |    R
	zp_from_pc,
	//  3   |  0,D+DO          | Data Low              |   R/W
	logic_zp,
	nextInst];
	var INST_ZPG_W = [zp_from_pc, logic_zp_w, nextInst];

	/*
	 * LDA $FF,X 2
	 */
	var INST_ZPG_X = [
		// 2   |  PBR,PC+1        | Direct Offset         |    R
		zp_x_from_pc,
		//  3   |  PBR,PC+1        | Internal Operation    |    R 
		logic_zp,
		// 4   |  0,D+DO+I        | Data Low              |   R/W
		// Need to do the read so the VIAs reset if it happens to be reading the VIA
		nullOp,
		nextInst];
	var INST_ZPG_Y = [
		//  2   |  PBR,PC+1        | Direct Offset         |    R
		zp_y_from_pc,
		// 3   |  PBR,PC+1        | Internal Operation    |    R 
		//nullOp, FIXME
		// 4   |  0,D+DO+I        | Data Low              |   R/W 
		logic_zp,
		nextInst];
	var INST_ZPG_X_W = [zp_x_from_pc, nullOp, logic_zp_w, nextInst];
	var INST_ZPG_Y_W = [zp_y_from_pc, nullOp, logic_zp_w, nextInst];

	/*
	 * ASL $FF
	 */
	var INST_ZPGs = [
		// 2 | PBR,PC+1 | Direct Offset | R
		zp_from_pc,
		// 3 | 0,D+DO | Data Low | R 
		logic_zp,
		// 4 | 0,D+DO+1 | Internal Operation | R 
		// TODO unmodified data written back
		nullOp,
		// 5 | 0,D+DO | Data Low | W 
		temp_to_zp,
		// 
		nextInst ];

	/*
	 * ASL $FF,X 2 | PBR,PC+1 | Direct Offset | R 3 | PBR,PC+1 | Internal
	 * Operation | R 4 | 0,D+DO+X | Data Low | R (12)5 | 0,D+DO+X+1 | Internal
	 * Operation | R 6 | 0,D+DO+X | Data Low | W (12) Unmodified Data Low is
	 * written back to memory in 6502 emulation mode (E=1).
	 */
	var INST_ZPGs_X = [zp_x_from_pc, nullOp, logic_zp,
				nullOp // TODO unmod writeback
				, temp_to_zp, nextInst  ];

	/*
	 * PHP 2 | PBR,PC+1 | Internal Operation | R 3 | 0,S-1 | Register Low | W
	 */
	var INST_PUSH_P = [nullOp, pushP, nextInst];
	var INST_PHA = [nullOp, pushA, nextInst];

	/*
	 * PLP 2 | PBR,PC+1 | Internal Operation | R 3 | PBR,PC+1 | Internal
	 * Operation | R 4 | 0,S+1 | Register Low | R
	 */
	var INST_PLP = [nullOp, nullOp, plp, nextInst];
	var INST_PLA = [nullOp, nullOp, pla, nextInst];

	/*
	 * CLC 2 | PBR,PC+1 | Internal Operation | R
	 */
	var INST_FLAG_CLC = [ clc, nextInst ];
	var INST_FLAG_SEC = [ sec, nextInst ];
	var INST_FLAG_CLI = [ cli, nextInst ];
	var INST_FLAG_SEI = [ sei, nextInst ];
	var INST_FLAG_CLV = [ clv, nextInst ];
	var INST_FLAG_CLD = [ cld, nextInst ];
	var INST_FLAG_SED = [ sed, nextInst ];

	var INST_DEY = [dey, nextInst];
	var INST_DEX = [dex, nextInst];

	var INST_INY = [iny, nextInst];
	var INST_INX = [inx, nextInst];

	var INST_TYA = [tya, nextInst];
	var INST_TAY = [tay, nextInst];

	var INST_TXA = [txa, nextInst];
	var INST_TAX = [tax, nextInst];

	var INST_TXS = [txs, nextInst];
	var INST_TSX = [tsx, nextInst];

	/*
	 * ORA $FFFF,y 2 | PBR,PC+1 | Absolute Address Low | R 3 | PBR,PC+2 |
	 * Absolute Address High | R (4) 3a | DBR,AAH,AAL+IL | Internal Operation |
	 * R 4 | DBR,AA+I | Data Low | R/W (4) Add 1 cycle for indexing across page
	 * boundaries, or write.
	 */
	var INST_LOGIC_ABS_Y = [load_offset_abs_l,
				load_offset_abs_h_plus_y, nullOp, op_offset, nextInst];
	var INST_LOGIC_ABS_Y_RMW = [ load_offset_abs_l,
				load_offset_abs_h, offset_plus_y, op_offset_rmw, nullOp// TODO unmod
				// writeback
				, op_offset_w, nextInst ];
	var INST_LOGIC_ABS_Y_W = [ load_offset_abs_l,
				load_offset_abs_h, offset_plus_y_w, op_offset_w, nextInst];

	/*
	 * ASL A 2 | PBR,PC+1 | Internal Operation | R
	 */
	var INST_OP_A = [opa, nextInst];

	/*
	 * NOP 2 | PBR,PC+1 | Internal Operation | R
	 */
	var INST_NOP = [nullOp, nextInst];

	/*
	 * ORA abs 2 | PBR,PC+1 | Absolute Address Low | R 3 | PBR,PC+2 | Absolute
	 * Address High | R 4 | DBR,AA | Data Low | R/W
	 */
	var INST_ABS = [ load_offset_abs_l, load_offset_abs_h,
				op_offset, nextInst ];
	// Correct
	var INST_ABS_W = [load_offset_abs_l,
				load_offset_abs_h, op_offset_w, nextInst];

	/*
	 * JMP $FFFF 2 | PBR,PC+1 | NEW PCL | R 3 | PBR,PC+2 | NEW PCH | R
	 */
	var INST_JMP = [load_pc_abs_l, load_pc_abs_h, nextInst];

	/*
	 * JMP ($FFFF) 2 | PBR,PC+1 | Absolute Address Low | R 3 | PBR,PC+2 |
	 * Absolute Address High | R 4 | 0,AA | NEW PCL | R 5 | 0,AA+1 | NEW PCH | R
	 */
	var INST_JMP_IND = [load_offset_abs_l,
				load_offset_abs_h, load_pc_offset_l, load_pc_offset_h, nextInst];

	/*
	 * ORA $FFFF,X 2 | PBR,PC+1 | Absolute Address Low | R 3 | PBR,PC+2 |
	 * Absolute Address High | R (4) 3a | DBR,AAH,AAL+IL | Internal Operation |
	 * R 4 | DBR,AA+I | Data Low | R/W (4) Add 1 cycle for indexing across page
	 * boundaries, or write.
	 */
	var INST_ABS_X = [load_offset_abs_l,
				load_offset_abs_h, op_offset_plus_x, op_offset, nextInst];
	var INST_ABS_Y = [load_offset_abs_l,
				load_offset_abs_h, op_offset_plus_y, op_offset, nextInst];
	var INST_ABS_X_W = [load_offset_abs_l,
				load_offset_abs_h, offset_plus_x_w, op_offset_w, nextInst];

	/*
	 * LSR $FFFF 2 | PBR,PC+1 | Absolute Address Low | R 3 | PBR,PC+2 | Absolute
	 * Address High | R 4 | DBR,AA | Data Low | R 5 | DBR,AA+2 | Internal
	 * Operation | R 6 | DBR,AA | Data Low | W
	 */
	var INST_ABSs = [load_offset_abs_l, load_offset_abs_h,
				op_offset, nullOp // TODO unmod data writeback
				, temp_to_offset, nextInst];

	/*
	 * ASL $FFFF,X 2 | PBR,PC+1 | Absolute Address Low | R 3 | PBR,PC+2 |
	 * Absolute Address High | R 4 | DBR,AAH,AAL+XL | Internal Operation | R 5 |
	 * DBR,AA+X | Data Low | R 6 | DBR,AA+X+1 | Internal Operation | R 7 |
	 * DBR,AA+X | Data Low | W
	 */

	var INST_ABS_Xs = [load_offset_abs_l,
				load_offset_abs_h, offset_plus_x_w, op_offset, nullOp // TODO unmod
				// writeback
				, temp_to_offset, nextInst];
	var INST_ABS_Ys = [load_offset_abs_l,
				load_offset_abs_h, offset_plus_y_w, op_offset, nullOp,
				temp_to_offset, nextInst];

	// **********************************
	// Methods

	var instfunc = [BRK, // 00
			INST_X_IND, // ORA (z,x)
			INST_JAM, // JAM i
			INST_X_IND_RMW, // SLO (z,x)
			INST_ZPG, // NOP z
			INST_ZPG, // ORA z
			INST_ZPGs, // ASL z
			INST_ZPGs, // SLO z
			INST_PUSH_P, // 08 - PHP
			INST_LOGIC_IMM, // ORA #
			INST_OP_A, // ASL A
			INST_LOGIC_IMM, // ANC #
			INST_ABS, // NOP a
			INST_ABS, // ORA a
			INST_ABSs, // ASL a
			INST_ABSs, // SLO a
			INST_BCOND, // 10 - BPL r
			INST_IND_Y, // ORA (z),y
			INST_JAM, // JAM i
			INST_IND_Y_RMW, // SLO (z),y
			INST_ZPG_X, // NOP z,x
			INST_ZPG_X, // ORA z,x
			INST_ZPGs_X, // ASL z,x
			INST_ZPGs_X, // SLO z,x
			INST_FLAG_CLC, // 18 - CLC
			INST_LOGIC_ABS_Y, // ORA a,y
			INST_NOP, // NOP i
			INST_LOGIC_ABS_Y_RMW, // SLO a,y
			INST_ABS_X, // NOP a,x
			INST_ABS_X, // ORA a,x
			INST_ABS_Xs, // ASL a,x
			INST_ABS_Xs, // SLO a,x
			INST_JSR, // 20 - JSR a
			INST_X_IND, // AND (z,x)
			INST_JAM, // JAM i
			INST_X_IND_RMW, // RLA (z,x)
			INST_ZPG, // BIT z
			INST_ZPG, // AND z
			INST_ZPGs, // ROL z
			INST_ZPGs, // RLA z
			INST_PLP, // 28 - PLP s
			INST_LOGIC_IMM, // AND #
			INST_OP_A, // ROL A
			INST_LOGIC_IMM, // ANC #
			INST_ABS, // BIT a
			INST_ABS, // AND a
			INST_ABSs, // ROL a
			INST_ABSs, // RLA a
			INST_BCOND, // 30 - BMI r
			INST_IND_Y, // AND (z),y
			INST_JAM, // JAM i
			INST_IND_Y_RMW, // RLA (z), y
			INST_ZPG_X, // NOP z,x
			INST_ZPG_X, // AND z,x
			INST_ZPGs_X,// ROL z,x
			INST_ZPGs_X,// RLA z,x
			INST_FLAG_SEC, // 38 - SEC
			INST_LOGIC_ABS_Y, // AND a,y
			INST_NOP, // NOP i
			INST_LOGIC_ABS_Y_RMW, // RLA a,y
			INST_ABS_X, // NOP a,x
			INST_ABS_X, // AND a,x
			INST_ABS_Xs, // ROL a,x
			INST_ABS_Xs, // RLA a,X
			INST_RTI, // 40 - RTI s
			INST_X_IND, // EOR (z,x)
			INST_JAM, // JAM i
			INST_X_IND_RMW, // SRE (z,x)
			INST_ZPG, // NOP z
			INST_ZPG, // EOR z
			INST_ZPGs, // LSR z
			INST_ZPGs, // SRE z
			INST_PHA, // 48 - PHA
			INST_LOGIC_IMM, // EOR #
			INST_OP_A, // LSR A
			INST_LOGIC_IMM, // ASR #
			INST_JMP, // JMP a
			INST_ABS, // EOR a
			INST_ABSs, // LSR a
			INST_ABSs, // SRE a
			INST_BCOND, // 50 - BVC r
			INST_IND_Y, // EOR (z),y
			INST_JAM, // JAM i
			INST_IND_Y_RMW, // SRE (z),y
			INST_ZPG_X, // NOP z,x
			INST_ZPG_X, // EOR z,x
			INST_ZPGs_X, // LSR z,x
			INST_ZPGs_X, // SRE z,x
			INST_FLAG_CLI, // 58 - CLI
			INST_LOGIC_ABS_Y, // EOR a,y
			INST_NOP, // NOP i
			INST_LOGIC_ABS_Y_RMW, // SRE a,y
			INST_ABS_X, // NOP a,x
			INST_ABS_X, // EOR a,x
			INST_ABS_Xs, // LSR a,x
			INST_ABS_Xs, // SRE a,x
			INST_RTS, // 60 - RTS
			INST_X_IND, // ADC (z,x)
			INST_JAM, // JAM i
			INST_X_IND_RMW, // RRA (z,x)
			INST_ZPG, // NOP z
			INST_ZPG, // ADC z
			INST_ZPGs, // ROR z
			INST_ZPGs, // RRA z
			INST_PLA, // 68 - PLA
			INST_LOGIC_IMM, // ADC #
			INST_OP_A, // ROR A
			INST_LOGIC_IMM, // ARR #
			INST_JMP_IND, // JMP (a)
			INST_ABS, // ADC a
			INST_ABSs, // ROR a
			INST_ABSs, // RRA a
			INST_BCOND, // 70 - BVS r
			INST_IND_Y, // ADC (z),y
			INST_JAM, // JAM i
			INST_IND_Y_RMW, // RRA (z), y
			INST_ZPG_X, // NOP z,x
			INST_ZPG_X, // ADC z,x
			INST_ZPGs_X, // ROR z,x
			INST_ZPGs_X, // RRA z,x
			INST_FLAG_SEI, // 78 - SEI
			INST_LOGIC_ABS_Y, // ADC a,y
			INST_NOP, // NOP i
			INST_LOGIC_ABS_Y_RMW, // RRA a,y
			INST_ABS_X, // NOP a,x
			INST_ABS_X, // ADC a,x
			INST_ABS_Xs, // ROR a,x
			INST_ABS_Xs, // RRA a,x
			INST_LOGIC_IMM, // 80 - NOP #
			INST_X_IND_W, // STA (z,x)
			INST_LOGIC_IMM, // NOP #
			INST_X_IND_W, // SAX (z,x)
			INST_ZPG_W, // STY z
			INST_ZPG_W, // STA z
			INST_ZPG_W, // STX z
			INST_ZPG_W, // SAX z
			INST_DEY, // 88 - DEY
			INST_LOGIC_IMM, // NOP #
			INST_TXA, // TXA
			INST_LOGIC_IMM, // ANE #
			INST_ABS_W, // STY a
			INST_ABS_W, // STA a
			INST_ABS_W, // STX a
			INST_ABS_W, // SAX a
			INST_BCOND, // 90 - BCC r
			INST_IND_Y_W, // STA (z),y
			INST_JAM, // JAM i
			INST_BAD, // SHA a,x
			INST_ZPG_X_W, // STY z,x
			INST_ZPG_X_W, // STA z,x
			INST_ZPG_Y_W, // STX z,y
			INST_ZPG_Y_W, // SAX z,y
			INST_TYA, // 98 - TYA
			INST_LOGIC_ABS_Y_W, // STA a,y
			INST_TXS, // TXS
			INST_BAD, // SHS a,x
			INST_BAD, // SHY a,y
			INST_ABS_X_W, // STA a,x
			INST_BAD, // SHX a,y
			INST_BAD, // SHA a,y
			INST_LOGIC_IMM, // A0 - LDY #
			INST_X_IND, // LDA (z,x)
			INST_LOGIC_IMM, // LDX #
			INST_X_IND, // LAX (z,x)
			INST_ZPG, // LDY z
			INST_ZPG, // LDA z
			INST_ZPG, // LDX z
			INST_ZPG, // LAX z
			INST_TAY, // A8 - TAY
			INST_LOGIC_IMM, // LDA #
			INST_TAX, // TAX
			INST_LOGIC_IMM, // LXA #
			INST_ABS, // LDY a
			INST_ABS, // LDA a
			INST_ABS, // LDX a
			INST_ABS, // LAX a
			INST_BCOND, // B0 - BCS r
			INST_IND_Y, // LDA (z),y
			INST_JAM, // JAM i
			INST_IND_Y, // LAX (z),y
			INST_ZPG_X, // LDY z,x
			INST_ZPG_X, // LDA z,x
			INST_ZPG_Y, // LDX z,y
			INST_ZPG_Y, // LAX z,y
			INST_FLAG_CLV, // B8 - CLV
			INST_LOGIC_ABS_Y, // LDA a,y
			INST_TSX, // TSX
			INST_LOGIC_ABS_Y, // LAE a,y
			INST_ABS_X, // LDY a,x
			INST_ABS_X, // LDA a,x
			INST_ABS_Y, // LDX a,y
			INST_ABS_Y, // LAX a,y
			INST_LOGIC_IMM, // C0 - CPY #
			INST_X_IND, // CMP (z,x)
			INST_LOGIC_IMM, // NOP #
			INST_X_IND_I, // DCP (z,x)
			INST_ZPG, // CPY z
			INST_ZPG, // CMP z
			INST_ZPGs, // DEC z
			INST_ZPGs, // DCP z
			INST_INY, // C8 - INY
			INST_LOGIC_IMM, // CMP #
			INST_DEX, // DEX
			INST_LOGIC_IMM_SBX, // SBX #
			INST_ABS, // CPY a
			INST_ABS, // CMP a
			INST_ABSs, // DEC a
			INST_ABSs, // DCP a
			INST_BCOND, // D0 - BNE r
			INST_IND_Y, // CMP (z),y
			INST_JAM, // JAM i
			INST_Y_IND_I, // DCP (z),y
			INST_ZPG_X, // NOP z,x
			INST_ZPG_X, // CMP z,x
			INST_ZPGs_X, // DEC z,x
			INST_ZPGs_X, // DCP z,x
			INST_FLAG_CLD, // D8 - CLD
			INST_LOGIC_ABS_Y, // CMP a,y
			INST_NOP, // NOP i
			INST_ABS_Ys, // DCP a,y
			INST_ABS_X, // NOP a,x
			INST_ABS_X, // CMP a,x
			INST_ABS_Xs, // DEC a,x
			INST_ABS_Xs, // DCP a,x
			INST_LOGIC_IMM, // E0 - CPX #
			INST_X_IND, // SBC (z,x)
			INST_LOGIC_IMM, // NOP #
			INST_X_IND_I, // ISB (z,x)
			INST_ZPG, // CPX z
			INST_ZPG, // SBC z
			INST_ZPGs, // INC z
			INST_ZPGs,// ISB z
			INST_INX, // E8 - INX i
			INST_LOGIC_IMM, // SBC #
			INST_NOP, // NOP i
			INST_LOGIC_IMM, // SBC #
			INST_ABS, // CPX a
			INST_ABS, // SBC a
			INST_ABSs, // INC a
			INST_ABSs, // ISB a
			INST_BCOND, // F0 - BEQ r
			INST_IND_Y, // SBC (z),y
			INST_JAM, // JAM i
			INST_Y_IND_I, // ISB (z),y
			INST_ZPG_X, // NOP z,x
			INST_ZPG_X, // SBC z,x
			INST_ZPGs_X, // INC z,x
			INST_ZPGs_X, // ISB z,x
			INST_FLAG_SED, // F8 - SED
			INST_LOGIC_ABS_Y, // SBC a,y
			INST_NOP, // NOP i
			INST_ABS_Ys, // ISB a,y
			INST_ABS_X, // NOP a,x
			INST_ABS_X, // SBC a,x
			INST_ABS_Xs, // INC a,x
			INST_ABS_Xs // ISB a,x
			];

	var op = [ null, // 00 BRK
			ora, // ORA (z,x)
			null, // JAM
			slo, // SLO (z,x)
			nullProc, // NOP z
			ora, // ORA z
			asl, // ASL z
			slo, // SLO z
			null, // 08 - BPL r
			ora, // ORA #
			asl, // ASL A
			anc, // ANC #
			nullProc, // NOP a
			ora, // ORA a
			asl, // ASL a
			slo, // SLO a
			null, // 10 - BPL r
			ora, // ORA (z),y
			null, // JAM i
			slo, // SLO (z),y
			nullProc, // NOP z,x
			ora, // ORA z,x
			asl, // ASL z,x
			slo, // SLO z,x
			null, // 18 - CLC
			ora, // ORA a,y
			null, // NOP i
			slo, // SLO a,y
			nullProc, // NOP a,x
			ora, // ORA a,x
			asl, // ASL a,x
			slo, // SLO a,x
			null, // 20 - JSR a
			and, // AND (z,x)
			null, // JAM i
			rla, // RLA (z,x)
			bit, // BIT z
			and, // AND z
			rol, // ROL z
			rla, // RLA z
			null, // 28 - PLP s
			and, // AND #
			rol, // ROL A
			anc, // ANC #
			bit, // BIT a
			and, // AND a
			rol, // ROL a
			rla, // RLA a
			null, // 30 - BMI
			and, // AND (z),y
			null, // JAM i
			rla, // RLA (z), y
			nullProc, // NOP z,x
			and, // AND z,x
			rol, // ROL z,x
			rla, // RLA z,x
			null, // 38 - SEC
			and, // AND a,y
			null, // NOP
			rla, // RLA a,y
			nullProc, // NOP a,x
			and, // AND a,x
			rol, // ROL a,x
			rla, // RLA a,x
			null, // 40 - RTI
			eor, // EOR (z,x)
			null, // JAM i
			sre, // SRE (z,x)
			nullProc, // NOP z,x
			eor, // EOR z,x
			lsr, // LSR z,x
			sre, // SRE z,x
			null, // 48 - PHA
			eor, // EOR #
			lsr, // LSR A
			asr, // ASR #
			null, // JMP a
			eor, // EOR a
			lsr, // LSR a
			sre, // SRE a
			null, // 50 - BVC r
			eor, // EOR (z),y
			null, // JAM i
			sre, // SRE (z),y
			nullProc, // NOP z,x
			eor, // EOR z,x
			lsr, // LSR z,x
			sre, // SRE z,x
			null, // 58 - CLI
			eor, // EOR a,y
			null, // NOP i
			sre, // SRE a,y
			nullProc, // NOP a,x
			eor, // EOR a,x
			lsr, // LSR a,x
			sre, // SRE a,x
			null, // 60 - RTS
			adc, // ADC (z,x)
			null, // JAM i
			rra, // RRA (z,x)
			nullProc, // NOP z
			adc, // ADC z
			ror, // ROR z
			rra, // RRA z
			null, // 68
			adc, // ADC #
			ror, // ROR a
			arr, // ARR #
			null, // JMP (a)
			adc, // ADC a
			ror, // ROR a
			rra, // RRA a
			null, // 70 - BVS r
			adc, // ADC (z),y
			null, // JAM i
			rra, // RRA (z),y
			nullProc, // NOP z,x
			adc, // ADC z,x
			ror, // ROR z,x
			rra, // RRA z,x
			null, // 78 - SEI
			adc, // ADC a,y
			null, // NOP i
			rra, // RRA a,y
			nullProc, // NOP a,x
			adc, // ADC a,x
			ror, // ROR a,x
			rra, // RRA a,x
			nullProc, // 80 - NOP #
			sta, // STA (z,x)
			nullProc, // NOP #
			sax, // SAX (z,x)
			sty, // STY z
			sta, // STA z
			stx, // STX z
			sax, // SAX z
			null, // 88 - DEY i
			nullProc, // NOP #
			null, // TXA
			ane, // ANE #
			sty, // STY a
			sta, // STA a
			stx, // STX a
			sax, // SAX a
			null, // 90 - BCC
			sta, // STA (z),y
			null, // JAM i
			null, // SHA a,x
			sty, // STY z,x
			sta, // STA z,x
			stx, // STX z,y
			sax, // SAX z,y
			null, // 98 - TYA
			sta, // STA a,y
			null, // TXS
			null, // SHS a,x
			null, // SHY a,y
			sta, // STA a,x
			null, // SHX a,y
			null, // SHA a,y
			ldy, // A0
			lda, // LDA (z,x)
			ldx, // LDX #
			lax, // LAX (z,x)
			ldy, // LDY a
			lda, // LDA z
			ldx, // LDX z
			lax, // LAX z
			null, // A8 - TAY
			lda, // LDA #
			null, // TAX
			lxa, // LXA
			ldy, // LDY a
			lda, // LDA a
			ldx, // LDX a
			lax, // LAX a
			null, // B0 - CLV
			lda, // LDA (z),y
			null, // JAM i
			lax, // LAX (z),y
			ldy, // LDY z,x
			lda, // LDA z,x
			ldx, // LDX z,y
			lax, // LAX z,y
			null, // B8 - CLV
			lda, // LDA a,y
			null, // TSX
			lae, // LAE a,y
			ldy, // LDY a,x
			lda, // LDA a,x
			ldx, // LDX a,y
			lax, // LAX a,y
			cpy, // C0 - CPY #
			cmp, // CMP (z,x)
			nullProc, // NOP #
			dcp, // DCP (z,x)
			cpy, // CPY z
			cmp, // CMP z
			dec, // DEC z
			dcp, // DCP z
			null, // C8 - INY
			cmp, // CMP #
			null, // DEX i
			null, // SBX #
			cpy, // CPY a
			cmp, // CMP a
			dec, // DEC a
			dcp, // DCP a
			null, // D0 - BNE r
			cmp, // cmp (z),y
			null, // JAM i
			dcp, // DCP (z),y
			nullProc, // NOP z,x
			cmp, // CMP z,x
			dec, // DEC z,x
			dcp, // DCP z,x
			null, // D8 - CLD
			cmp, // CMP a,y
			null, // NOP i
			dcp, // DCP a,y
			nullProc, // NOP a,x
			cmp, // CMP a,x
			dec, // DEC a,x
			dcp, // DCP a,x
			cpx, // E0 - CPX #
			sbc, // SBC (z,x)
			nullProc, // NOP #
			isb, // ISB (z,x)
			cpx, // CPX z
			sbc, // SBC z
			inc, // INC z
			isb, // ISB z
			null, // E8 - INX i
			sbc, // SBC #
			null, // NOP i
			sbc, // SBC #
			cpx, // CPX a
			sbc, // SBC a
			inc, // INC a
			isb, // ISB a
			null, // F0 - BEQ r
			sbc, // SBC (z),y
			null, // JAM i
			isb, // ISB (z),y
			nullProc, // NOP z,x
			sbc, // SBC z,x
			inc, // INC z,x
			isb, // ISB z,x
			null, // F8 - SED
			sbc, // SBC a,y
			null, // NOP i
			isb, // ISB a,y
			nullProc, // NOP a,x
			sbc, // SBC a,x
			inc, // INC a,x
			isb // ISB a,x
	];

	this.isNextInst = function() {
		return currentInst[currentInstOffset]==nextInst;
	}
	
	this.cycle = function() {
		currentInst[currentInstOffset++]();
		nmiBits = (nmiBits << 1) | (nmiSource.test()?1:0); 
		irqBits = (irqBits << 1) | (((p & I) || !irqSource.test())?0:1);
	}

	this.reset = function() {
		currentInst = INST_RESET;
		currentInstOffset = 0;

		prevNmi = 0;
		irqBits = 0;
		nmiBits = 0;
		a = x = y = sp = pc = b = 0;
		np = null;
		p = R;
	}
	
	this.reset();
}
 