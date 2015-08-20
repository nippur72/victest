$.extend(Config, new function() {	
	this.joykeys = true;
});

var keysdown = [0,0,0,0,0,0,0,0];
var up, down, left, right, fire;
var pageup = 0;
keymap=[[50]/*2*/,[52]/*4*/,[54]/*6*/,[56]/*8*/,[48]/*0*/,[187,107,61]/*=*/,[36]/*Home*/,[118]/*F4(F7)*/,
	[81]/*q*/,[69]/*e*/,[84]/*t*/,[85]/*u*/,[79]/*o*/,[219,91]/*[*/,[-1]/*Up arr*/,[116]/*F3*/,
	[17]/*Ctrl(CBM)*/,[83]/*s*/,[70]/*f*/,[72]/*h*/,[75]/*k*/,[186,59]/*;*/,[220,92]/*\*/,[114]/*F2(F3)*/,
	[32]/* */,[90]/*z*/,[67]/*c*/,[66]/*b*/,[77]/*m*/,[190,46]/*.*/,[16]/*Shift*/,[112]/*F1*/,
    [20]/*Caps(Runstop)*/,[16]/*shift*/,[88]/*x*/,[86]/*v*/,[78]/*n*/,[188,44]/*,*/,[191,47]/*/*/,[40]/*down arrow*/,
    [9]/*Tab*/,[65]/*a*/,[68]/*d*/,[71]/*g*/,[74]/*j*/,[76]/*l*/,[222]/*'*/,[39]/*right arrow*/,
    [192,96]/*`*/,[87]/*w*/,[82]/*r*/,[89]/*y*/,[73]/*i*/,[80]/*p*/,[221,93]/*]*/,[13]/*Enter*/,
    [49]/*1*/,[51]/*3*/,[53]/*5*/,[55]/*7*/,[57]/*9*/,[189,109]/*-*/,[220,92]/*\*/,[8]/*Backspace*/];
	
function KeyboardInit() {
	Config.joykeys = 1;
	up = down = left = right = fire = 0;
  	
	KeyboardHook();

	document.onhelp = function() {return(false);}
	window.onhelp = function() {return(false);}
}

function KeyboardHook() {
	document.onkeypress=function(){return false};
	document.onkeydown=keyDown;
	document.onkeyup=keyUp;
}

function KeyboardUnhook() {
	document.onkeypress=null
	document.onkeydown=null;
	document.onkeyup=null;
}

function keyDown(e) {
	var keyCode = document.all? event.keyCode:e.which;
	cancelKeyEvent(e);
	applyKey(keyCode,false);
	return false;
}

function cancelKeyEvent(e) {
	if (window.event) {
		try { window.event.keyCode = 0; } catch (e) { }
		window.event.returnValue = false;
		window.event.cancelBubble = true;
	}
	if (e.preventDefault) e.preventDefault();
	if (e.stopPropagation) e.stopPropagation();
}

function keyUp(e) {
	var keyCode = document.all? event.keyCode:e.which;
	cancelKeyEvent(e);
	applyKey(keyCode,true);
	return false;
}  

function applyKey(sym,keyup) {

	if (Config.joykeys) {
		var isJoystick = true;

		if (sym==37) left = !keyup;
		else if (sym==39) right = !keyup;
		else if (sym==38) up = !keyup;
		else if (sym==40) down = !keyup;
		else if (sym==192 || sym==96) fire = !keyup;
		else isJoystick = false;
		if (isJoystick) return;
	}
  
	if (sym==33) {
		pageup = keyup?1:0;
		vic20.via2.ca1 = pageup;
	}
  
	for(var i=0; i<64; i++) {
	var kml = keymap[i].length;
	 for(var j=0; j<kml; j++) {
			if(keymap[i][j]==sym) {
				if (keyup) keysdown[7-(i>>3)]&=~(1<<(i&7)); else keysdown[7-(i>>3)]|=(1<<(i&7));
				//return;
			 }
		  }
		}
		
		if (sym==113) { // F2
			if (keyup) {
				keysdown[3]&=~0x02; // SHIFT
				keysdown[4]&=~0x80;
			}
			else {
				keysdown[3]|=0x02; // SHIFT
				keysdown[4]|=0x80;
			}
		}
		else if (sym==115) { // F4
			if (keyup) {
				keysdown[3]&=~0x02; // SHIFT
				keysdown[5]&=~0x80;
			}
			else {
				keysdown[3]|=0x02; // SHIFT
				keysdown[5]|=0x80;
			}
		}
		else if (sym==117) { // F6
			if (keyup) {
				keysdown[3]&=~0x02; // SHIFT
				keysdown[6]&=~0x80;
			}
			else {
				keysdown[3]|=0x02; // SHIFT
				keysdown[6]|=0x80;
			}
		}
		else if (sym==119) { // F8
			if (keyup) {
				keysdown[3]&=~0x02; // SHIFT
				keysdown[7]&=~0x80;
			}
			else {
				keysdown[3]|=0x02; // SHIFT
				keysdown[7]|=0x80;
			}
		}
		else if (sym==37) { // Right
			if (keyup) {
				keysdown[3]&=~0x02; // SHIFT
				keysdown[2]&=~0x80;
			}
			else {
				keysdown[3]|=0x02; // SHIFT
				keysdown[2]|=0x80;
			}
		}
		else if (sym==38) { // Down
			if (keyup) {
				keysdown[3]&=~0x02; // SHIFT
				keysdown[3]&=~0x80;
			}
			else {
				keysdown[3]|=0x02; // SHIFT
				keysdown[3]|=0x80;
			}
		}
}
