import { camsMap } from '@/lib/server/camsMap';

export const dynamic = 'force-dynamic';

/** Humo de incendios: espesor óptico de los aerosoles de quema de biomasa a 550 nm (Copernicus CAMS). */
export const GET = () => camsMap('composition_bbaod550', 'sh_Oranges_aod');
