// Mini-format du texte de la popup explicative (édité par Léo dans i18n.ts) :
//   - une ligne vide sépare deux paragraphes ;
//   - un \n simple reste un saut de ligne dans le paragraphe (whitespace-pre-line) ;
//   - [mots] passe les mots en typo titre (Gill Sans, .font-display).
// Parseur pur : testable sans DOM, consommé par IntroPopup.

export type IntroSegment = { text: string; display: boolean }

export function parseIntroParagraphs(body: string): IntroSegment[][] {
  return body
    .split(/\n\s*\n/)
    .map((para) =>
      para
        .split(/(\[[^\]]*\])/)
        .filter((part) => part.length > 0)
        .map((part) =>
          part.startsWith('[') && part.endsWith(']')
            ? { text: part.slice(1, -1), display: true }
            : { text: part, display: false }
        )
    )
    .filter((para) => para.length > 0)
}
