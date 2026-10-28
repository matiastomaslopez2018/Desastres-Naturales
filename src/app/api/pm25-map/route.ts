import { camsMap } from '@/lib/server/camsMap';

export const dynamic = 'force-dynamic';

/**
 * Partículas finas PM2,5 a nivel del suelo (Copernicus CAMS), con los colores del índice diario de calidad del
 * aire del Reino Unido (DAQI, de DEFRA): solo se pinta desde 12 µg/m³.
 */
export const GET = () => camsMap('composition_pm2p5', 'sh_all_pm2p5_defra_daqi');
