import { useTranslation } from '../../i18n/useTranslation';
export default function QRDemo() {
  const { t } = useTranslation();
  return <svg viewBox="0 0 120 120" role="img" aria-label={t("QR ilustrativo de demostración")}><rect width="120" height="120" fill="#fffdf7" />
    <g fill="none" stroke="#1e3a52" strokeWidth="6"><rect x="10" y="10" width="28" height="28" /><rect x="82" y="10" width="28" height="28" /><rect x="10" y="82" width="28" height="28" /></g>
    <g fill="#1e3a52"><rect x="19" y="19" width="10" height="10" /><rect x="91" y="19" width="10" height="10" /><rect x="19" y="91" width="10" height="10" />
      {[ [48,8,8,16], [62,16,8,22], [46,33,8,9], [8,48,20,8], [32,58,8,16], [48,48,14,14], [68,48,10,25], [86,48,24,8], [88,62,8,16], [100,70,10,20], [48,72,8,22], [61,84,18,8], [85,86,8,24], [100,100,10,10], [48,104,24,6], [60,62,8,12], [12,62,9,8] ].map(([x,y,width,height], index) => <rect key={index} x={x} y={y} width={width} height={height} />)}
    </g></svg>;
}
