import { autocompletion } from "@codemirror/autocomplete";
import { indentWithTab } from "@codemirror/commands";
import { sql } from "@codemirror/lang-sql";
import { oneDark } from "@codemirror/theme-one-dark";
import { keymap } from "@codemirror/view";
import { EditorView, basicSetup } from "codemirror";
import React, { useEffect, useRef } from "react";

/**
 * Renders the SQL editor component.
 */
function SQLEditor({ value = "", onChange }) {
  const editorRef = useRef(null);

  useEffect(() => {
    const schema = {
      comments: [
        "id",
        "authorDisplayName",
        "textOriginal",
        "likeCount",
        "totalReplyCount",
        "publishedAt",
      ],
    };

    const editor = new EditorView({
      doc: value,
      extensions: [
        basicSetup,
        keymap.of([indentWithTab]),
        sql({
          schema: schema,
          upperCaseKeywords: true,
          defaultTable: "comments",
        }),
        autocompletion(),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString());
          }
        }),
        oneDark,
      ],
      parent: editorRef.current,
    });

    editor.dom.style.fontSize = "12px";
    editor.dom.style.lineHeight = "1";

    return () => editor.destroy();
  }, [onChange]); // Removed `value` from the dependency array

  return <div id="sql-editor" ref={editorRef} />;
}

export default SQLEditor;
