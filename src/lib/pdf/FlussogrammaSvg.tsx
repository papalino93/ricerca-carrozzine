import { Fragment } from "react";
import { Line, Path, StyleSheet, Svg, Rect, Text, View } from "@react-pdf/renderer";
import { ALLEGATO_A_FASI } from "@/lib/fascicoli-testi";
import { ACCENT, INK, INK_SOFT } from "./shared";

// Il testo NON passa dal componente <Text> di libreria SVG (i suoi tipi non
// dichiarano fontSize/fontWeight, e in pratica il rendering dei font al suo
// interno è meno affidabile): l'Svg qui sotto contiene solo le forme
// (rettangoli, frecce), il testo è normale <Text> di react-pdf sovrapposto
// con position:"absolute" alle stesse coordinate — stesso meccanismo già
// usato per l'header/footer fissi dei documenti.
const BOX_W = 460;
const BOX_H = 54;
const GAP = 24;
const START_X = 10;
const ARROW_W = 8;

const styles = StyleSheet.create({
  wrap: { position: "relative", marginTop: 12 },
  box: { position: "absolute", left: START_X, width: BOX_W, padding: 7 },
  faseTitle: { fontSize: 9, fontWeight: 700, color: INK },
  faseDescrizione: { fontSize: 7.5, color: INK_SOFT, marginTop: 2 },
  faseDocumenti: { fontSize: 7, color: INK_SOFT, marginTop: 2 },
});

/**
 * Flussogramma di progettazione (ISO 13485, 7.3.1-7.3.7): rappresentazione
 * grafica della stessa procedura fissa già stampata come tabella —
 * riquadri collegati da frecce invece di righe, come nel documento Word
 * originale. Documento fisso: uguale per ogni commessa (vedi
 * fascicoli-testi.ts, ALLEGATO_A_FASI).
 */
export function FlussogrammaSvg() {
  const n = ALLEGATO_A_FASI.length;
  const totalH = n * BOX_H + (n - 1) * GAP;
  const svgWidth = START_X * 2 + BOX_W;
  const cx = START_X + BOX_W / 2;

  return (
    <View style={styles.wrap}>
      <Svg width={svgWidth} height={totalH}>
        {ALLEGATO_A_FASI.map((f, i) => {
          const y = i * (BOX_H + GAP);
          return (
            <Rect
              key={f.fase}
              x={START_X}
              y={y}
              width={BOX_W}
              height={BOX_H}
              rx={7}
              ry={7}
              fill="#e7f0e3"
              stroke={ACCENT}
              strokeWidth={1.2}
            />
          );
        })}
        {Array.from({ length: n - 1 }).map((_, i) => {
          const yStart = i * (BOX_H + GAP) + BOX_H;
          const yEnd = yStart + GAP;
          return (
            <Fragment key={`arrow-${i}`}>
              <Line x1={cx} y1={yStart} x2={cx} y2={yEnd - 5} stroke={ACCENT} strokeWidth={1.5} />
              <Path
                d={`M ${cx - ARROW_W / 2} ${yEnd - 5} L ${cx + ARROW_W / 2} ${yEnd - 5} L ${cx} ${yEnd} Z`}
                fill={ACCENT}
              />
            </Fragment>
          );
        })}
      </Svg>
      {ALLEGATO_A_FASI.map((f, i) => {
        const y = i * (BOX_H + GAP);
        return (
          <View key={f.fase} style={[styles.box, { top: y, height: BOX_H }]}>
            <Text style={styles.faseTitle}>{f.fase}</Text>
            <Text style={styles.faseDescrizione}>{f.descrizione}</Text>
            <Text style={styles.faseDocumenti}>
              {f.documenti} · Resp. {f.responsabile}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
