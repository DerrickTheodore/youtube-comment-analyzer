import { useEffect, useRef } from "react";
import { EditorView, basicSetup } from "codemirror";
import { sql } from "@codemirror/lang-sql";
import { oneDark } from "@codemirror/theme-one-dark";
import { autocompletion } from "@codemirror/autocomplete";
import { keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";

function SQLEditor({ onChange }) {
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
      doc: "",
      extensions: [
        basicSetup,
        keymap.of([indentWithTab]),
        sql({
          dialect: sql.sqlite,
          schema: schema,
          upperCaseKeywords: true,
          defaultTable: "comments",
        }),
        autocompletion(),
        oneDark,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString());
          }
        }),
      ],
      parent: editorRef.current,
    });

    return () => editor.destroy();
  }, [onChange]);

  return <div ref={editorRef} style={{ height: "100%" }} />;
}

export default SQLEditor;
