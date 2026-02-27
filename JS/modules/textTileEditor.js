/**
 * Text tile editor: per-tile contenteditable and inline formatting only (Bold, Italic, Underline).
 * Font size, text color, alignment, and lists are controlled globally (Edit tab/sidebar).
 * Backward compatible: plain content (no HTML) is set as textContent; rich content as innerHTML.
 */

const DEFAULT_FONT_SIZE = 16;

/** True if content looks like HTML (e.g. contains tags). */
export function isHtmlContent(content) {
  if (typeof content !== 'string') return false;
  return /<[a-z][\s\S]*>/i.test(content);
}

/** Get current editor content as HTML. */
export function getEditorContent(editorEl) {
  return editorEl ? editorEl.innerHTML : '';
}

/**
 * Set editor content. Backward compatible: if content has no tags, set as plain text.
 */
export function setEditorContent(editorEl, content) {
  if (!editorEl) return;
  const raw = (content ?? '').trim();
  if (isHtmlContent(raw)) {
    editorEl.innerHTML = raw;
  } else {
    editorEl.textContent = raw;
  }
}

/**
 * Save the current selection to the editor element so it can be restored when applying
 * alignment/list from the global Edit tab. Called on mouseup/keyup when selection is inside editor.
 */
function saveSelectionToEditor(editorEl) {
  if (!editorEl) return;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (!editorEl.contains(range.commonAncestorContainer)) return;
  try {
    editorEl._savedRange = range.cloneRange();
  } catch (_) {}
}

/**
 * Apply an execCommand to the current selection, or to the given editor if no selection.
 * Restores focus to the editor so the command applies there.
 */
function execCommandOnEditor(editorEl, command, value = null) {
  if (!editorEl) return;
  editorEl.focus();
  try {
    if (value != null) {
      document.execCommand(command, false, value);
    } else {
      document.execCommand(command, false);
    }
  } catch (_) {
    // execCommand can throw in some browsers; ignore
  }
}

/**
 * Build per-tile toolbar: inline formatting only (Bold, Italic, Underline).
 * Font size, color, alignment, and lists are in the global Edit controls.
 */
export function buildToolbar(container, editorEl) {
  const bar = document.createElement('div');
  bar.className = 'text-tile-toolbar';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Inline text formatting');

  const btn = (title, cmd) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'text-tile-toolbar-btn';
    b.title = title;
    b.setAttribute('aria-label', title);
    b.addEventListener('click', (e) => {
      e.preventDefault();
      execCommandOnEditor(editorEl, cmd);
    });
    return b;
  };

  const bold = btn('Bold', 'bold');
  bold.textContent = 'B';
  bold.style.fontWeight = 'bold';
  const italic = btn('Italic', 'italic');
  italic.textContent = 'I';
  italic.style.fontStyle = 'italic';
  const underline = btn('Underline', 'underline');
  underline.textContent = 'U';
  underline.style.textDecoration = 'underline';
  bar.appendChild(bold);
  bar.appendChild(italic);
  bar.appendChild(underline);

  container.appendChild(bar);
  return bar;
}

/**
 * Initialize the text tile editor: contenteditable + optional per-tile B/I/U toolbar.
 * Block formatting (font size, color, alignment, lists) is applied from global Edit controls via state/render.
 * - onContentChange(html) when content changes (input).
 */
export function initTextEditor(postElement, item, editMode, onContentChange) {
  const textBody = document.createElement('div');
  textBody.className = 'text-only-content';

  textBody.style.color = item.textColor || '#000000';
  textBody.style.fontSize = `${item.fontSize ?? DEFAULT_FONT_SIZE}px`;
  /* Alignment is per-line via execCommand from global Edit tab; no whole-tile textAlign. */

  setEditorContent(textBody, item.content || item.caption || '');

  if (editMode) {
    textBody.contentEditable = 'true';
    textBody.setAttribute('contenteditable', 'true');

    textBody.addEventListener('input', () => {
      onContentChange?.(getEditorContent(textBody));
    });

    /* Track selection so global alignment/list apply to current selection or line. */
    const saveSelection = () => saveSelectionToEditor(textBody);
    textBody.addEventListener('mouseup', saveSelection);
    textBody.addEventListener('keyup', saveSelection);

    const toolbarWrap = document.createElement('div');
    toolbarWrap.className = 'text-tile-toolbar-wrap';
    buildToolbar(toolbarWrap, textBody);
    postElement.appendChild(toolbarWrap);
  }

  postElement.appendChild(textBody);
  return textBody;
}
