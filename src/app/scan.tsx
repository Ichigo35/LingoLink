import { ComingSoon } from '@/components/ui/coming-soon';

export default function ScanScreen() {
  return (
    <ComingSoon
      icon="📷"
      title="Scanner un QR code"
      description="Scannez le QR d'une conversation pour la rejoindre : lecture du token, vérification de validité et d'expiration, puis ouverture de l'écran de conversation."
      phase="Phase 3"
    />
  );
}
