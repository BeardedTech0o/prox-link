// Bridges a hidden <textarea> to a noVNC RFB session. A VNC session renders
// the remote desktop into a <canvas> with no DOM text input, so mobile
// browsers have nothing to attach an on-screen keyboard to. This textarea
// exists purely to give them something focusable; keystrokes typed into it
// are translated to X11 keysyms and forwarded to the RFB session instead of
// being kept in the textarea itself.
//
// Regular character keys are read from the 'input' event (not keydown/keyup)
// because mobile virtual keyboards frequently omit real key events for
// predictive/composed text, only ever firing 'input'. Named control keys
// (Enter, Backspace, arrows, ...) usually do fire a proper keydown even from
// on-screen keyboards, so those are intercepted there instead.

const XK_BackSpace = 0xff08;
const XK_Tab = 0xff09;
const XK_Return = 0xff0d;
const XK_Escape = 0xff1b;
const XK_Delete = 0xffff;
const XK_Home = 0xff50;
const XK_End = 0xff57;
const XK_Left = 0xff51;
const XK_Up = 0xff52;
const XK_Right = 0xff53;
const XK_Down = 0xff54;

const SPECIAL_KEYS: Record<string, [number, string]> = {
  Enter: [XK_Return, 'Enter'],
  Backspace: [XK_BackSpace, 'Backspace'],
  Tab: [XK_Tab, 'Tab'],
  Escape: [XK_Escape, 'Escape'],
  Delete: [XK_Delete, 'Delete'],
  ArrowLeft: [XK_Left, 'ArrowLeft'],
  ArrowRight: [XK_Right, 'ArrowRight'],
  ArrowUp: [XK_Up, 'ArrowUp'],
  ArrowDown: [XK_Down, 'ArrowDown'],
  Home: [XK_Home, 'Home'],
  End: [XK_End, 'End'],
};

// X11 keysyms for Latin-1 map 1:1 to the code point; everything else uses
// the Unicode keysym extension (0x01000000 + code point).
function keysymForChar(ch: string): number {
  const cp = ch.codePointAt(0) ?? 0;
  return cp >= 0x20 && cp <= 0xff ? cp : 0x01000000 + cp;
}

interface KeySender {
  sendKey(keysym: number, code: string, down?: boolean): void;
}

export function attachMobileKeyboard(rfb: KeySender, el: HTMLTextAreaElement): () => void {
  const press = (keysym: number, code: string) => {
    rfb.sendKey(keysym, code, true);
    rfb.sendKey(keysym, code, false);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const special = SPECIAL_KEYS[e.key];
    if (!special) return;
    e.preventDefault();
    press(special[0], special[1]);
    el.value = '';
  };

  const onInput = (e: Event) => {
    const inputType = (e as InputEvent).inputType;
    const data = (e as InputEvent).data;
    if (inputType === 'deleteContentBackward') {
      press(XK_BackSpace, 'Backspace');
    } else if (inputType === 'insertLineBreak') {
      press(XK_Return, 'Enter');
    } else {
      for (const ch of data ?? el.value) press(keysymForChar(ch), 'Unidentified');
    }
    el.value = '';
  };

  el.addEventListener('keydown', onKeyDown);
  el.addEventListener('input', onInput);
  return () => {
    el.removeEventListener('keydown', onKeyDown);
    el.removeEventListener('input', onInput);
  };
}
