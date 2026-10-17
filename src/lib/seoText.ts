import type { Lang } from './types';

/*
 * Textos de las páginas de búsqueda frecuente (sismo hoy, volcanes activos, etc.).
 * Las cifras se arman siempre con datos de las fuentes; nada se estima.
 */

type Fn<A extends unknown[]> = (...a: A) => string;

export type SeoText = {
  suffix: string;
  updatedEvery: string;
  sourceNote: string;
  quakesToday: { title: string; h1: string; kicker: string; desc: string; lead: Fn<[n: string, max: string]>; leadNone: string; byCountry: string; listTitle: string };
  quakesIn: {
    title: Fn<[c: string]>; h1: Fn<[c: string]>; kicker: string; desc: Fn<[c: string]>;
    lead: Fn<[c: string, n24: string, n30: string]>; biggest: Fn<[mag: string, place: string, when: string]>; leadNone: Fn<[c: string, n30: string]>;
    listTitle: string; small: Fn<[agency: string]>; smallGeneric: string; history: Fn<[c: string]>; other: string;
  };
  volcanoesNow: { title: string; h1: string; kicker: string; desc: string; lead: Fn<[n: string, alerts: string]>; ongoing: string; recent: string; since: string };
  fires: { title: string; h1: string; kicker: string; desc: string; lead: Fn<[n: string]>; firms: Fn<[n: string, cells: string]>; listTitle: string; mapLink: string };
  hurricanes: { title: string; h1: string; kicker: string; desc: string; leadNhc: Fn<[n: string, names: string]>; leadNoNhc: string; otherBasins: Fn<[n: string]>; nhcTitle: string; listTitle: string };
  tsunami: {
    title: string; h1: string; kicker: string; desc: string; active: Fn<[n: string]>; none: string; checked: Fn<[when: string]>;
    messages: string; flagged: string; flaggedNote: string; official: string; noMessages: string;
  };
  volcano: {
    title: Fn<[name: string, country: string]>; desc: Fn<[name: string, country: string]>; kicker: string;
    facts: { country: string; type: string; last: string; coords: string; elevation: string; number: string };
    statusNow: string; statusOngoing: Fn<[since: string]>; statusNew: string; statusNone: string;
    recent: string; recentNone: string; bce: string; unknown: string; allActive: string;
  };
  more: string;
};

export const SEO: Record<Lang, SeoText> = {
  es: {
    suffix: 'Atlas de Desastres',
    updatedEvery: 'Datos oficiales actualizados automáticamente.',
    sourceNote: 'Fuentes: USGS, NASA EONET, GDACS, NOAA y Smithsonian GVP. Cada evento enlaza su fuente primaria.',
    quakesToday: {
      title: 'Sismo hoy: últimos terremotos en el mundo en vivo',
      h1: 'Sismos de hoy en el mundo',
      kicker: 'Sismo hoy · en vivo',
      desc: 'Lista en vivo de los terremotos de las últimas 24 horas en todo el mundo, con magnitud, lugar, hora y profundidad según el USGS.',
      lead: (n, max) => `En las últimas 24 horas el USGS registró ${n} sismos de magnitud 2,5 o más en el mundo. El mayor: ${max}.`,
      leadNone: 'En las últimas 24 horas el USGS no registró sismos de magnitud 2,5 o más.',
      byCountry: 'Sismos hoy por país',
      listTitle: 'Últimos sismos (24 horas)',
    },
    quakesIn: {
      title: (c) => `Sismo hoy en ${c}: últimos temblores en vivo`,
      h1: (c) => `Sismos hoy en ${c}`,
      kicker: 'Temblores en vivo',
      desc: (c) => `Últimos sismos y temblores en ${c} en vivo: magnitud, lugar, hora y profundidad de cada uno según el USGS, con enlace a la fuente.`,
      lead: (c, n24, n30) => `En las últimas 24 horas se registraron ${n24} sismos de magnitud 2,5 o más en ${c}, y ${n30} en los últimos 30 días.`,
      biggest: (mag, place, when) => `El mayor del mes fue de magnitud ${mag}, ${place}, el ${when}.`,
      leadNone: (c, n30) => `En las últimas 24 horas no se registraron sismos de magnitud 2,5 o más en ${c}. En los últimos 30 días: ${n30}.`,
      listTitle: 'Sismos de los últimos 30 días',
      small: (a) => `El catálogo global del USGS puede no incluir todos los sismos chicos. Para temblores menores, consultá a ${a}.`,
      smallGeneric: 'El catálogo global del USGS puede no incluir todos los sismos chicos de este país; para temblores menores, consultá al servicio sismológico nacional.',
      history: (c) => `Historia y estadísticas de ${c}`,
      other: 'Sismos hoy en otros países',
    },
    volcanoesNow: {
      title: 'Volcanes activos ahora: erupciones en curso en el mundo',
      h1: 'Volcanes activos ahora',
      kicker: 'Erupciones en curso',
      desc: 'Volcanes en erupción hoy en el mundo según el Smithsonian Global Volcanism Program, con alertas de GDACS y NASA EONET.',
      lead: (n, alerts) => `El Smithsonian Global Volcanism Program registra ${n} erupciones en curso. En los últimos 30 días hubo ${alerts} eventos volcánicos informados por GDACS o NASA EONET.`,
      ongoing: 'Erupciones en curso (Smithsonian GVP)',
      recent: 'Actividad informada en los últimos 30 días',
      since: 'en erupción desde',
    },
    fires: {
      title: 'Incendios forestales en vivo: mapa y lista de incendios activos',
      h1: 'Incendios forestales en vivo',
      kicker: 'Incendios activos',
      desc: 'Incendios forestales activos en el mundo según NASA EONET y GDACS, y focos de calor de las últimas 24 horas detectados por satélite (NASA FIRMS).',
      lead: (n) => `NASA EONET y GDACS informan ${n} incendios forestales con datos en los últimos 7 días.`,
      firms: (n, cells) => `Los satélites VIIRS detectaron ${n} focos de calor en las últimas 24 horas (NASA FIRMS), agrupados en ${cells} celdas de 0,25°. No todo foco es un incendio forestal.`,
      listTitle: 'Incendios con datos en los últimos 7 días',
      mapLink: 'Ver los focos de calor en el mapa',
    },
    hurricanes: {
      title: 'Huracanes activos hoy: ciclones y tormentas tropicales en vivo',
      h1: 'Huracanes y ciclones activos',
      kicker: 'Ciclones tropicales en vivo',
      desc: 'Huracanes, tifones y tormentas tropicales activos hoy: posición, viento y pronóstico del NHC (NOAA), más los ciclones de otras cuencas según GDACS y NASA EONET.',
      leadNhc: (n, names) => `El Centro Nacional de Huracanes (NHC) sigue ${n} ciclones activos en el Atlántico y el Pacífico este/central: ${names}.`,
      leadNoNhc: 'El Centro Nacional de Huracanes (NHC) no tiene ciclones activos en el Atlántico ni en el Pacífico este/central.',
      otherBasins: (n) => `En todas las cuencas, GDACS y NASA EONET informaron ${n} ciclones y tormentas con datos en los últimos 7 días.`,
      nhcTitle: 'Ciclones activos según NHC',
      listTitle: 'Ciclones y tormentas de los últimos 7 días (todas las cuencas)',
    },
    tsunami: {
      title: 'Alerta de tsunami hoy: avisos vigentes en vivo',
      h1: 'Alerta de tsunami hoy',
      kicker: 'Centros de alerta de tsunami',
      desc: 'Alertas, advertencias y vigilancias de tsunami vigentes hoy según los centros de alerta de NOAA (NTWC y PTWC), y sismos recientes marcados por el USGS.',
      active: (n) => `Hay ${n} avisos de tsunami vigentes (alerta, advertencia o vigilancia) de los centros de NOAA.`,
      none: 'No hay alertas, advertencias ni vigilancias de tsunami vigentes de los centros de NOAA (NTWC y PTWC).',
      checked: (w) => `Consultado: ${w}.`,
      messages: 'Últimos mensajes de los centros de alerta',
      flagged: 'Sismos de los últimos 7 días con indicador de tsunami del USGS',
      flaggedNote: 'El indicador del USGS marca sismos grandes en zonas oceánicas; no confirma que haya habido tsunami. La señal oficial son los mensajes de NTWC/PTWC y de cada país.',
      official: 'Ante un sismo fuerte o largo en la costa, no esperes la alerta: andá a un lugar alto. Seguí siempre las instrucciones de las autoridades de tu país.',
      noMessages: 'Los centros no publicaron mensajes recientes.',
    },
    volcano: {
      title: (n, c) => `Volcán ${n}${c ? ` (${c})` : ''}: actividad, erupciones y datos`,
      desc: (n, c) => `Volcán ${n}${c ? `, ${c}` : ''}: estado de actividad, última erupción, tipo de volcán, ubicación e imágenes según el Smithsonian Global Volcanism Program.`,
      kicker: 'Volcán',
      facts: { country: 'País', type: 'Tipo de volcán', last: 'Última erupción conocida', coords: 'Coordenadas', elevation: 'Altura', number: 'Número GVP' },
      statusNow: 'Actividad ahora',
      statusOngoing: (s) => `En erupción desde ${s} según el Smithsonian GVP.`,
      statusNew: 'Con actividad nueva informada esta semana (reporte semanal GVP/USGS).',
      statusNone: 'El Smithsonian GVP no lo registra hoy entre las erupciones en curso.',
      recent: 'Actividad informada en el último año (GDACS / NASA EONET)',
      recentNone: 'GDACS y NASA EONET no informaron actividad de este volcán en el último año.',
      bce: 'a. C.', unknown: 'Sin dato', allActive: 'Ver todos los volcanes activos ahora',
    },
    more: 'Ver más',
  },
  en: {
    suffix: 'Disaster Atlas',
    updatedEvery: 'Official data, updated automatically.',
    sourceNote: 'Sources: USGS, NASA EONET, GDACS, NOAA and Smithsonian GVP. Every event links to its primary source.',
    quakesToday: {
      title: 'Earthquake today: latest earthquakes worldwide, live',
      h1: 'Earthquakes today worldwide',
      kicker: 'Earthquake today · live',
      desc: 'Live list of the earthquakes of the last 24 hours worldwide, with magnitude, location, time and depth from the USGS.',
      lead: (n, max) => `In the last 24 hours the USGS recorded ${n} earthquakes of magnitude 2.5 or greater worldwide. The largest: ${max}.`,
      leadNone: 'In the last 24 hours the USGS recorded no earthquakes of magnitude 2.5 or greater.',
      byCountry: 'Earthquakes today by country',
      listTitle: 'Latest earthquakes (24 hours)',
    },
    quakesIn: {
      title: (c) => `Earthquake today in ${c}: latest tremors live`,
      h1: (c) => `Earthquakes today in ${c}`,
      kicker: 'Live tremors',
      desc: (c) => `Latest earthquakes and tremors in ${c}, live: magnitude, location, time and depth of each one from the USGS, with a link to the source.`,
      lead: (c, n24, n30) => `In the last 24 hours ${n24} earthquakes of magnitude 2.5 or greater were recorded in ${c}, and ${n30} in the last 30 days.`,
      biggest: (mag, place, when) => `The largest this month was magnitude ${mag}, ${place}, on ${when}.`,
      leadNone: (c, n30) => `No earthquakes of magnitude 2.5 or greater were recorded in ${c} in the last 24 hours. In the last 30 days: ${n30}.`,
      listTitle: 'Earthquakes in the last 30 days',
      small: (a) => `The USGS global catalog may miss some small earthquakes. For minor tremors, check ${a}.`,
      smallGeneric: 'The USGS global catalog may miss some small earthquakes in this country; for minor tremors, check the national seismological service.',
      history: (c) => `History and statistics for ${c}`,
      other: 'Earthquakes today in other countries',
    },
    volcanoesNow: {
      title: 'Active volcanoes now: ongoing eruptions worldwide',
      h1: 'Active volcanoes now',
      kicker: 'Ongoing eruptions',
      desc: 'Volcanoes erupting today worldwide according to the Smithsonian Global Volcanism Program, with GDACS and NASA EONET alerts.',
      lead: (n, alerts) => `The Smithsonian Global Volcanism Program lists ${n} ongoing eruptions. In the last 30 days GDACS or NASA EONET reported ${alerts} volcanic events.`,
      ongoing: 'Ongoing eruptions (Smithsonian GVP)',
      recent: 'Activity reported in the last 30 days',
      since: 'erupting since',
    },
    fires: {
      title: 'Wildfires live: map and list of active wildfires',
      h1: 'Wildfires live',
      kicker: 'Active wildfires',
      desc: 'Active wildfires worldwide according to NASA EONET and GDACS, plus satellite hotspots of the last 24 hours (NASA FIRMS).',
      lead: (n) => `NASA EONET and GDACS report ${n} wildfires with data in the last 7 days.`,
      firms: (n, cells) => `VIIRS satellites detected ${n} hotspots in the last 24 hours (NASA FIRMS), grouped into ${cells} cells of 0.25°. Not every hotspot is a wildfire.`,
      listTitle: 'Wildfires with data in the last 7 days',
      mapLink: 'See hotspots on the map',
    },
    hurricanes: {
      title: 'Active hurricanes today: tropical cyclones and storms live',
      h1: 'Active hurricanes and cyclones',
      kicker: 'Tropical cyclones live',
      desc: 'Hurricanes, typhoons and tropical storms active today: position, wind and forecast from NHC (NOAA), plus cyclones in other basins from GDACS and NASA EONET.',
      leadNhc: (n, names) => `The National Hurricane Center (NHC) is tracking ${n} active cyclones in the Atlantic and east/central Pacific: ${names}.`,
      leadNoNhc: 'The National Hurricane Center (NHC) has no active cyclones in the Atlantic or the east/central Pacific.',
      otherBasins: (n) => `Across all basins, GDACS and NASA EONET reported ${n} cyclones and storms with data in the last 7 days.`,
      nhcTitle: 'Active cyclones according to NHC',
      listTitle: 'Cyclones and storms of the last 7 days (all basins)',
    },
    tsunami: {
      title: 'Tsunami alert today: current warnings live',
      h1: 'Tsunami alert today',
      kicker: 'Tsunami warning centers',
      desc: 'Tsunami warnings, advisories and watches in effect today from the NOAA warning centers (NTWC and PTWC), plus recent earthquakes flagged by the USGS.',
      active: (n) => `There are ${n} tsunami messages in effect (warning, advisory or watch) from the NOAA centers.`,
      none: 'There are no tsunami warnings, advisories or watches in effect from the NOAA centers (NTWC and PTWC).',
      checked: (w) => `Checked: ${w}.`,
      messages: 'Latest messages from the warning centers',
      flagged: 'Earthquakes of the last 7 days with the USGS tsunami flag',
      flaggedNote: 'The USGS flag marks large earthquakes in oceanic regions; it does not confirm a tsunami. The official signal is the NTWC/PTWC messages and those of each country.',
      official: 'If you feel a strong or long earthquake on the coast, do not wait for an alert: move to high ground. Always follow the instructions of your local authorities.',
      noMessages: 'The centers have not published recent messages.',
    },
    volcano: {
      title: (n, c) => `${n} volcano${c ? ` (${c})` : ''}: activity, eruptions and facts`,
      desc: (n, c) => `${n} volcano${c ? `, ${c}` : ''}: activity status, last eruption, volcano type, location and images according to the Smithsonian Global Volcanism Program.`,
      kicker: 'Volcano',
      facts: { country: 'Country', type: 'Volcano type', last: 'Last known eruption', coords: 'Coordinates', elevation: 'Elevation', number: 'GVP number' },
      statusNow: 'Activity now',
      statusOngoing: (s) => `Erupting since ${s} according to the Smithsonian GVP.`,
      statusNew: 'New activity reported this week (GVP/USGS weekly report).',
      statusNone: 'The Smithsonian GVP does not list it today among ongoing eruptions.',
      recent: 'Activity reported in the last year (GDACS / NASA EONET)',
      recentNone: 'GDACS and NASA EONET reported no activity for this volcano in the last year.',
      bce: 'BCE', unknown: 'No data', allActive: 'See all active volcanoes now',
    },
    more: 'See more',
  },
};
