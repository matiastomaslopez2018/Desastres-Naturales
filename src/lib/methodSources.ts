import type { Lang } from './types';

/*
 * Metodología, Fase 3 · G: ficha de cada fuente (qué cubre, cada cuánto se actualiza,
 * licencia y limitaciones) y lista de las interpretaciones que hace el sitio.
 * "Acá" se refiere a cada cuánto la consulta este sitio; la fuente puede publicar más seguido.
 */

type Bi = Record<Lang, string>;
export type MethodSource = { name: string; url: string; covers: Bi; freq: Bi; license: Bi; limits: Bi };
export type MethodGroup = { title: Bi; sources: MethodSource[] };

const CC = { es: 'Copernicus: datos libres y abiertos, con atribución (Reglamento Delegado UE 1159/2013).', en: 'Copernicus: free and open data, with attribution (EU Delegated Regulation 1159/2013).' };
const USPD = (who: string): Bi => ({ es: `Dominio público (${who}, gobierno de EE. UU.). Se cita la fuente.`, en: `Public domain (${who}, US government). The source is credited.` });

export const METHOD_GROUPS: MethodGroup[] = [
  {
    title: { es: 'Terremotos y contexto tectónico', en: 'Earthquakes and tectonic setting' },
    sources: [
      {
        name: 'USGS ComCat · productos del evento', url: 'https://earthquake.usgs.gov/data/comcat/',
        covers: { es: 'Sismos del mundo (desde M2,5 o M4,5 según el período), mecanismo focal (tensor de momento), resumen tectónico, pronóstico de réplicas (OAF), PAGER y ShakeMap.', en: 'Earthquakes worldwide (from M2.5 or M4.5 depending on the period), focal mechanism (moment tensor), tectonic summary, aftershock forecast (OAF), PAGER and ShakeMap.' },
        freq: { es: 'Casi en tiempo real. Los productos de cada sismo se piden al abrir la ficha y se guardan 1 hora si el sismo es reciente y 30 días si es viejo.', en: 'Near real time. Each quake\'s products are requested when its page opens and kept 1 hour if recent, 30 days if old.' },
        license: USPD('USGS'),
        limits: { es: 'Las soluciones preliminares cambian. El tensor de momento solo existe para sismos medianos y grandes (en general M5+). El pronóstico de réplicas solo se publica para algunos sismos. El resumen tectónico está en inglés; si hay traducción, es automática.', en: 'Preliminary solutions change. Moment tensors exist only for moderate and large quakes (usually M5+). Aftershock forecasts are published only for some quakes. The tectonic summary is in English; any translation is automatic.' },
      },
      {
        name: 'INPRES · Instituto Nacional de Prevención Sísmica (Argentina)', url: 'https://www.inpres.gob.ar/',
        covers: { es: 'Sismos de la Argentina y zonas vecinas que localiza la Red Nacional de Estaciones Sismológicas, incluidos los chicos que el USGS no publica. Marca si fue revisado por un sismólogo y si fue sentido.', en: 'Earthquakes in Argentina and nearby areas located by the National Seismological Station Network, including small ones the USGS does not publish. It flags whether a seismologist reviewed it and whether it was felt.' },
        freq: { es: 'Acá se consulta cada 5 minutos su fuente XML de los últimos 30 sismos; lo leído se guarda en la base.', en: 'Its XML feed of the latest 30 quakes is queried here every 5 minutes; what is read is stored in the database.' },
        license: { es: 'Fuente XML que el INPRES ofrece para difundir sus sismos. Se cita la fuente y se enlaza cada sismo a su ficha.', en: 'XML feed INPRES offers to disseminate its earthquakes. The source is credited and each quake links to its page.' },
        limits: { es: 'Los sismos en azul son automáticos y pueden estar errados. Solo da la provincia, no la distancia a una localidad. Si el USGS tiene el mismo sismo (menos de 90 s y 120 km de diferencia), se muestra el del USGS con la magnitud del INPRES.', en: 'Blue quakes are automatic and may be wrong. Only the province is given, not the distance to a town. If the USGS has the same quake (less than 90 s and 120 km apart), the USGS one is shown with the INPRES magnitude.' },
      },
      {
        name: 'Centro Sismológico Nacional, Universidad de Chile (CSN)', url: 'https://www.sismologia.cl/',
        covers: { es: 'Catálogo diario de sismos de Chile y zonas vecinas, con referencia geográfica, profundidad y magnitud (en general MLv o Mww).', en: 'Daily earthquake catalog for Chile and nearby areas, with geographic reference, depth and magnitude (usually MLv or Mww).' },
        freq: { es: 'Acá se leen el día de hoy y el de ayer cada 5 minutos, y los 30 días anteriores una sola vez.', en: 'Today and yesterday are read here every 5 minutes, and the previous 30 days once.' },
        license: { es: 'Su política permite usar los datos con fines académicos y de divulgación citando "Centro Sismológico Nacional de la Universidad de Chile".', en: 'Its policy allows using the data for academic and outreach purposes, crediting "Centro Sismológico Nacional de la Universidad de Chile".' },
        limits: { es: 'Mismo criterio de unión con el USGS que el INPRES. Un sismo informado por los dos organismos se muestra una vez, con el del país donde ocurrió.', en: 'Same rule for merging with the USGS as INPRES. A quake reported by both agencies is shown once, by the one of the country where it happened.' },
      },
      {
        name: 'INPRES · zonificación sísmica (Reglamento INPRES-CIRSOC 103)', url: 'http://contenidos.inpres.gob.ar/zonas',
        covers: { es: 'Zona sísmica oficial (0 a 4) y aceleración máxima del suelo de diseño de un punto de la Argentina, que se muestra en «Mi lugar».', en: 'Official seismic zone (0 to 4) and design peak ground acceleration of a point in Argentina, shown in “My place”.' },
        freq: { es: 'La zonificación es la del reglamento vigente; cada punto se consulta una vez y se guarda un año.', en: 'The zoning is that of the current building code; each point is queried once and kept for a year.' },
        license: { es: 'Herramienta pública del INPRES. Se cita la fuente y se enlaza la herramienta.', en: 'Public INPRES tool. The source is credited and the tool is linked.' },
        limits: { es: 'Es un mapa normativo para construir, no un pronóstico. El INPRES terminó en 2022 un mapa de peligrosidad actualizado que todavía no reemplaza al del reglamento. La ubicación se redondea a ~1 km.', en: 'It is a building-code map, not a forecast. INPRES completed an updated hazard map in 2022 that does not yet replace the code map. The location is rounded to ~1 km.' },
      },
      {
        name: 'NOAA NCEI · bases de sismos y tsunamis significativos', url: 'https://www.ngdc.noaa.gov/hazel/',
        covers: { es: 'Sismos y tsunamis históricos con daños, víctimas, M7,5+ o tsunami, desde la Antigüedad. Se muestran los que están a 300 km o menos del evento.', en: 'Historical earthquakes and tsunamis with damage, deaths, M7.5+ or a tsunami, since antiquity. Those within 300 km of the event are shown.' },
        freq: { es: 'NCEI la actualiza de forma continua; acá se consulta cada 7 días.', en: 'NCEI updates it continuously; it is queried here every 7 days.' },
        license: USPD('NOAA'),
        limits: { es: 'Solo eventos "significativos": los registros antiguos son incompletos y dependen de documentos históricos.', en: 'Only "significant" events: older records are incomplete and depend on historical documents.' },
      },
      {
        name: 'PB2002 (Bird, 2003)', url: 'https://github.com/fraxen/tectonicplates',
        covers: { es: '52 placas y el tipo de cada tramo de borde (subducción, dorsal, transformante, etc.).', en: '52 plates and the type of each boundary segment (subduction, ridge, transform, etc.).' },
        freq: { es: 'Modelo fijo de 2003.', en: 'Fixed 2003 model.' },
        license: { es: 'Artículo científico (Bird, 2003, G³); versión GeoJSON de Hugo Ahlenius bajo ODC-By.', en: 'Scientific article (Bird, 2003, G³); GeoJSON version by Hugo Ahlenius under ODC-By.' },
        limits: { es: 'Los bordes están simplificados y en zonas de deformación difusa (por ejemplo, Asia central) una línea no describe bien la realidad.', en: 'Boundaries are simplified, and in zones of diffuse deformation (for example Central Asia) a line does not describe reality well.' },
      },
      {
        name: 'NNR-MORVEL56 (Argus, Gordon y DeMets, 2011)', url: 'https://doi.org/10.1029/2011GC003751',
        covers: { es: 'Velocidad angular de 56 placas. Con ella se calcula la velocidad relativa en un punto y las flechas de "Movimiento de placas".', en: 'Angular velocity of 56 plates, used to compute the relative velocity at a point and the "Plate motion" arrows.' },
        freq: { es: 'Modelo fijo de 2011.', en: 'Fixed 2011 model.' },
        license: { es: 'Valores publicados en un artículo científico (G³), citados con su referencia.', en: 'Values published in a scientific article (G³), cited with their reference.' },
        limits: { es: 'Supone placas rígidas y promedia millones de años: no es el movimiento medido en un año puntual. Algunas microplacas de PB2002 no están en el modelo y se usan las de la placa mayor vecina.', en: 'Assumes rigid plates and averages millions of years: it is not the motion measured in a given year. Some PB2002 microplates are not in the model and the neighboring major plate is used.' },
      },
      {
        name: 'USGS Slab2 (Hayes et al., 2018)', url: 'https://www.sciencebase.gov/catalog/item/5aa1b00ee4b0b1c392e86467',
        covers: { es: 'Profundidad de las placas que se hunden en 27 zonas de subducción, como curvas cada 20 km.', en: 'Depth of subducting plates in 27 subduction zones, as contours every 20 km.' },
        freq: { es: 'Modelo fijo de 2018.', en: 'Fixed 2018 model.' },
        license: USPD('USGS'),
        limits: { es: 'Fuera de esas 27 zonas no hay datos. Entre curvas, la profundidad se interpola acá (ver Interpretaciones).', en: 'Outside those 27 zones there is no data. Between contours, depth is interpolated here (see Interpretations).' },
      },
    ],
  },
  {
    title: { es: 'Volcanes', en: 'Volcanoes' },
    sources: [
      {
        name: 'Smithsonian Global Volcanism Program (GVP)', url: 'https://volcano.si.edu/',
        covers: { es: 'Volcanes del Holoceno (últimos ~11.700 años), sus erupciones con IEV, ambiente tectónico, tipo de roca y el reporte semanal de actividad (con USGS).', en: 'Holocene volcanoes (last ~11,700 years), their eruptions with VEI, tectonic setting, rock type and the weekly activity report (with USGS).' },
        freq: { es: 'Reporte semanal los miércoles; acá se consulta cada 6 horas. Fichas de volcanes: cada 30 días; erupciones: cada 7 días.', en: 'Weekly report on Wednesdays; queried here every 6 hours. Volcano records: every 30 days; eruptions: every 7 days.' },
        license: { es: 'Uso libre citando la fuente: Global Volcanism Program, Smithsonian Institution, Volcanoes of the World.', en: 'Free use citing the source: Global Volcanism Program, Smithsonian Institution, Volcanoes of the World.' },
        limits: { es: 'Muchas erupciones antiguas no tienen IEV o fecha precisa. El reporte semanal resume lo que informan los observatorios; no es una alerta.', en: 'Many older eruptions lack a VEI or precise date. The weekly report summarizes what observatories report; it is not an alert.' },
      },
      {
        name: 'USGS Volcano Hazards Program (HANS)', url: 'https://volcanoes.usgs.gov/hans2/',
        covers: { es: 'Nivel de alerta volcánica y código de aviación oficiales de los volcanes de EE. UU.', en: 'Official volcano alert level and aviation color code for US volcanoes.' },
        freq: { es: 'Cada vez que un observatorio emite un aviso; acá se consulta cada 30 minutos.', en: 'Whenever an observatory issues a notice; queried here every 30 minutes.' },
        license: USPD('USGS'),
        limits: { es: 'Solo EE. UU. Para otros países se enlaza al observatorio nacional y al VAAC (centro de avisos de ceniza para la aviación) que corresponde.', en: 'US only. For other countries the national observatory and the matching VAAC (aviation volcanic ash advisory center) are linked.' },
      },
    ],
  },
  {
    title: { es: 'Tsunamis', en: 'Tsunamis' },
    sources: [
      {
        name: 'NOAA tsunami.gov (NTWC y PTWC)', url: 'https://www.tsunami.gov/',
        covers: { es: 'Mensajes oficiales de los centros de alerta de tsunami de EE. UU., con sus mapas de tiempos de llegada cuando los publican.', en: 'Official messages from the US tsunami warning centers, with their travel-time maps when published.' },
        freq: { es: 'En tiempo real; acá se consulta cada 5 minutos.', en: 'Real time; queried here every 5 minutes.' },
        license: USPD('NOAA'),
        limits: { es: 'Las alertas para cada país las emite su organismo nacional, que es el que vale para la población.', en: 'Warnings for each country are issued by its national agency, which is the one that counts for the public.' },
      },
      {
        name: 'NOAA NDBC · boyas DART', url: 'https://www.ndbc.noaa.gov/dart/dart.shtml',
        covers: { es: 'Ubicación de las boyas DART que miden la presión en el fondo del mar y su última lectura.', en: 'Location of the DART buoys that measure sea-floor pressure and their latest reading.' },
        freq: { es: 'En modo normal envían datos cada 6 horas; al detectar una onda pasan a modo evento, con lecturas de 15 segundos a 1 minuto. Acá la lista se consulta cada 6 horas.', en: 'In standard mode they report every 6 hours; when they detect a wave they switch to event mode, with 15-second to 1-minute readings. The list is queried here every 6 hours.' },
        license: USPD('NOAA'),
        limits: { es: '"Transmitiendo" solo indica que NDBC informa datos recientes. Varias boyas suelen estar fuera de servicio.', en: '"Reporting" only means NDBC lists recent data. Several buoys are usually out of service.' },
      },
    ],
  },
  {
    title: { es: 'Ciclones tropicales', en: 'Tropical cyclones' },
    sources: [
      {
        name: 'NOAA National Hurricane Center (NHC)', url: 'https://www.nhc.noaa.gov/',
        covers: { es: 'Ciclones del Atlántico y del Pacífico este y central: posición, cono de pronóstico, radios de viento, trayectoria pasada y avisos.', en: 'Atlantic and eastern and central Pacific cyclones: position, forecast cone, wind radii, past track and advisories.' },
        freq: { es: 'Avisos cada 6 horas (más seguido con avisos de costa); acá se consulta cada 15 minutos.', en: 'Advisories every 6 hours (more often with coastal watches); queried here every 15 minutes.' },
        license: USPD('NOAA'),
        limits: { es: 'El cono muestra dónde puede estar el centro (en 2 de cada 3 casos históricos), no el tamaño de la tormenta: los daños pueden ocurrir fuera del cono.', en: 'The cone shows where the center may be (in 2 out of 3 historical cases), not the size of the storm: damage can occur outside it.' },
      },
      {
        name: 'GDACS · JTWC y otros centros', url: 'https://www.gdacs.org/',
        covers: { es: 'Ciclones de las demás cuencas, con la trayectoria, el cono y el nivel de alerta de GDACS; la fuente meteorológica suele ser el JTWC.', en: 'Cyclones in the other basins, with GDACS track, cone and alert level; the meteorological source is usually JTWC.' },
        freq: { es: 'Cada aviso nuevo; acá se consulta cada 30 minutos.', en: 'Each new advisory; queried here every 30 minutes.' },
        license: { es: 'GDACS (ONU y Comisión Europea): uso libre citando la fuente.', en: 'GDACS (UN and European Commission): free use citing the source.' },
        limits: { es: 'El JTWC usa viento medio de 1 minuto y los centros regionales de la OMM, de 10 minutos: los valores no son directamente comparables. El aviso oficial para cada país es el de su servicio meteorológico.', en: 'JTWC uses 1-minute mean wind and WMO regional centers 10-minute: values are not directly comparable. The official warning for each country is its weather service\'s.' },
      },
      {
        name: 'IBTrACS v04 (NOAA NCEI)', url: 'https://www.ncei.noaa.gov/products/international-best-track-archive',
        covers: { es: 'Trayectorias históricas de ciclones. Acá se usan las de 1980 en adelante que llegaron a 64 kt (119 km/h).', en: 'Historical cyclone tracks. Those from 1980 onward that reached 64 kt (119 km/h) are used here.' },
        freq: { es: 'NCEI la actualiza varias veces por año; el índice de este sitio se regenera a mano.', en: 'NCEI updates it several times a year; this site\'s index is regenerated by hand.' },
        license: USPD('NOAA'),
        limits: { es: 'Combina agencias con criterios distintos; antes de la era satelital la cobertura es incompleta.', en: 'Combines agencies with different criteria; coverage is incomplete before the satellite era.' },
      },
    ],
  },
  {
    title: { es: 'Incendios', en: 'Wildfires' },
    sources: [
      {
        name: 'NASA FIRMS · VIIRS 375 m', url: 'https://firms.modaps.eosdis.nasa.gov/',
        covers: { es: 'Focos de calor detectados por satélite (últimas 24 horas en el mapa y 7 días en la ficha).', en: 'Satellite-detected hotspots (last 24 hours on the map and 7 days on the page).' },
        freq: { es: 'Menos de 3 horas después de cada pasada; acá, cada 30 minutos (mapa) y cada 3 horas (ficha).', en: 'Under 3 hours after each pass; here, every 30 minutes (map) and every 3 hours (page).' },
        license: { es: 'NASA: datos abiertos, uso libre con crédito.', en: 'NASA: open data, free use with credit.' },
        limits: { es: 'Un foco es un píxel caliente, no el perímetro del incendio. Nubes y humo los ocultan; también detecta industrias y volcanes. Cada satélite pasa unas 2 veces por día.', en: 'A hotspot is a hot pixel, not the fire perimeter. Clouds and smoke hide them; industry and volcanoes are detected too. Each satellite passes about twice a day.' },
      },
      {
        name: 'Copernicus GWIS / EFFIS · FWI (modelo ECMWF)', url: 'https://gwis.jrc.ec.europa.eu/',
        covers: { es: 'Índice meteorológico de peligro de incendio (FWI) del día y de los próximos días, en todo el mundo.', en: 'Fire Weather Index (FWI) for today and the next days, worldwide.' },
        freq: { es: 'Diaria; acá se guarda 6 horas.', en: 'Daily; kept here for 6 hours.' },
        license: CC,
        limits: { es: 'Mide cuánto favorece el tiempo a un incendio, no si hay combustible ni si hay fuego. La resolución es de decenas de kilómetros.', en: 'Measures how much the weather favors fire, not whether there is fuel or fire. Resolution is tens of kilometers.' },
      },
      {
        name: 'NOAA GFS 0,25° · viento a 10 m', url: 'https://www.nco.ncep.noaa.gov/pmb/products/gfs/',
        covers: { es: 'Dirección y velocidad del viento en la ficha (0 a 48 horas) y en el mapa (análisis más reciente, con zoom).', en: 'Wind direction and speed on the page (0 to 48 hours) and on the map (latest analysis, when zoomed in).' },
        freq: { es: '4 corridas por día; acá se guarda 3 horas.', en: '4 runs a day; kept here for 3 hours.' },
        license: USPD('NOAA'),
        limits: { es: 'Es la salida de un modelo, no un pronóstico oficial. No resuelve vientos locales del relieve ni los que genera el propio fuego.', en: 'It is model output, not an official forecast. It does not resolve local terrain winds or those created by the fire itself.' },
      },
      {
        name: 'NIFC WFIGS · perímetros', url: 'https://data-nifc.opendata.arcgis.com/',
        covers: { es: 'Perímetro y superficie oficiales de incendios en EE. UU.', en: 'Official perimeter and area of US wildfires.' },
        freq: { es: 'Cuando los equipos del incidente los cargan; acá, cada 3 horas.', en: 'When incident teams upload them; here, every 3 hours.' },
        license: USPD('NIFC'),
        limits: { es: 'Solo EE. UU. Puede haber días de atraso. Para Europa se enlaza EFFIS y para el humo, Copernicus CAMS.', en: 'US only. May lag by days. EFFIS is linked for Europe and Copernicus CAMS for smoke.' },
      },
    ],
  },
  {
    title: { es: 'Inundaciones y sequías', en: 'Floods and droughts' },
    sources: [
      {
        name: 'Copernicus GloFAS', url: 'https://global-flood.emergency.copernicus.eu/',
        covers: { es: 'Pronóstico de crecidas en los grandes ríos (probabilidad de superar umbrales en los próximos 30 días).', en: 'Flood forecasts for large rivers (probability of exceeding thresholds in the next 30 days).' },
        freq: { es: 'Diaria.', en: 'Daily.' },
        license: CC,
        limits: { es: 'No sirve para crecidas repentinas ni ríos chicos. Es un pronóstico de modelo: vale lo que diga el servicio hidrológico del país.', en: 'Not suited to flash floods or small rivers. It is a model forecast: the national hydrological service prevails.' },
      },
      {
        name: 'NASA GPM IMERG (vía GIBS)', url: 'https://gpm.nasa.gov/data/imerg',
        covers: { es: 'Intensidad de lluvia estimada por satélite (mm/h).', en: 'Satellite-estimated rain rate (mm/h).' },
        freq: { es: 'Cada 30 minutos, con unas 4 horas de demora.', en: 'Every 30 minutes, about 4 hours behind.' },
        license: { es: 'NASA: datos abiertos, uso libre con crédito.', en: 'NASA: open data, free use with credit.' },
        limits: { es: 'Es una estimación: puede subestimar lluvias intensas y en montaña.', en: 'It is an estimate: it can underestimate intense and mountain rainfall.' },
      },
      {
        name: 'Copernicus EMS · Rapid Mapping', url: 'https://rapidmapping.emergency.copernicus.eu/',
        covers: { es: 'Mapas de zona afectada hechos a pedido de un país o de la ONU.', en: 'Affected-area maps produced at the request of a country or the UN.' },
        freq: { es: 'Solo cuando hay una activación; acá, cada 3 horas.', en: 'Only when activated; here, every 3 hours.' },
        license: CC,
        limits: { es: 'Solo existe para los eventos activados.', en: 'Exists only for activated events.' },
      },
      {
        name: 'Copernicus GDO · índice de riesgo de sequía para la agricultura', url: 'https://drought.emergency.copernicus.eu/',
        covers: { es: 'Nivel de sequía con impacto agrícola en todo el mundo.', en: 'Drought level with agricultural impact worldwide.' },
        freq: { es: 'Cada 10 días (décadas).', en: 'Every 10 days (dekads).' },
        license: CC,
        limits: { es: 'Resolución gruesa. El servicio no entrega el valor numérico: se lee el color del mapa oficial (ver Interpretaciones).', en: 'Coarse resolution. The service does not return the numeric value: the color of the official map is read (see Interpretations).' },
      },
      {
        name: 'U.S. Drought Monitor (NDMC, USDA, NOAA)', url: 'https://droughtmonitor.unl.edu/',
        covers: { es: 'Mapa semanal de sequía de EE. UU. (D0 a D4).', en: 'Weekly US drought map (D0 to D4).' },
        freq: { es: 'Semanal, los jueves.', en: 'Weekly, on Thursdays.' },
        license: { es: 'Uso libre con crédito al National Drought Mitigation Center.', en: 'Free use with credit to the National Drought Mitigation Center.' },
        limits: { es: 'Solo EE. UU.; combina datos con el juicio de expertos.', en: 'US only; combines data with expert judgment.' },
      },
    ],
  },
  {
    title: { es: 'Deslizamientos', en: 'Landslides' },
    sources: [
      {
        name: 'NASA LHASA (Landslide Hazard Assessment for Situational Awareness)', url: 'https://landslides.nasa.gov/',
        covers: { es: 'Probabilidad de deslizamientos provocados por lluvia hoy, de 60° S a 60° N, a unos 1 km. Combina lluvia GPM IMERG, humedad del suelo SMAP y susceptibilidad del terreno.', en: 'Probability of rain-triggered landslides today, 60° S to 60° N, at about 1 km. Combines GPM IMERG rainfall, SMAP soil moisture and terrain susceptibility.' },
        freq: { es: 'Diaria, con algunas horas de demora; acá el mapa se guarda 3 horas y el valor en un punto, 6 horas.', en: 'Daily, a few hours behind; here the map is kept 3 hours and point values 6 hours.' },
        license: { es: 'NASA: datos abiertos, uso libre con crédito.', en: 'NASA: open data, free use with credit.' },
        limits: { es: 'Solo deslizamientos por lluvia (no sismos ni deshielo). Es un modelo: no confirma que haya ocurrido un deslizamiento ni reemplaza los avisos del país.', en: 'Rain-triggered landslides only (not earthquakes or snowmelt). It is a model: it does not confirm a landslide happened or replace national warnings.' },
      },
      {
        name: 'NASA Global Landslide Catalog (COOLR)', url: 'https://gis.earthdata.nasa.gov/portal/rest/services/Landslides/COOLR_Reports_Points/FeatureServer',
        covers: { es: 'Deslizamientos registrados a partir de noticias, informes e inventarios (14.750 registros; en el mapa, los 2.846 con víctimas).', en: 'Landslides recorded from news, reports and inventories (14,750 records; the map shows the 2,846 with deaths).' },
        freq: { es: 'Sin actualizaciones regulares (el registro más reciente es de 2025); la capa del mapa se regenera a mano.', en: 'No regular updates (the latest record is from 2025); the map layer is regenerated by hand.' },
        license: { es: 'Permiso de uso, reproducción y distribución de NASA Goddard, con atribución.', en: 'NASA Goddard permission to use, reproduce and distribute, with attribution.' },
        limits: { es: 'Depende de que el hecho saliera en la prensa (sobre todo en inglés): faltan muchos eventos y la ubicación puede ser aproximada. NASA EONET tiene una categoría de deslizamientos, pero sin registros desde 2020.', en: 'Depends on press coverage (mostly English-language): many events are missing and locations may be approximate. NASA EONET has a landslide category, but with no records since 2020.' },
      },
      {
        name: 'USGS Ground Failure', url: 'https://earthquake.usgs.gov/data/ground-failure/',
        covers: { es: 'Estimación de deslizamientos y licuefacción provocados por un sismo, con nivel de alerta y población expuesta.', en: 'Estimate of earthquake-triggered landslides and liquefaction, with alert level and exposed population.' },
        freq: { es: 'Minutos u horas después de sismos con ShakeMap y potencial de daño; se actualiza con el ShakeMap.', en: 'Minutes to hours after quakes with a ShakeMap and damage potential; updated with the ShakeMap.' },
        license: USPD('USGS'),
        limits: { es: 'Modelo estadístico global (Nowicki Jessee et al., 2018): da probabilidades, no deslizamientos observados.', en: 'Global statistical model (Nowicki Jessee et al., 2018): it gives probabilities, not observed landslides.' },
      },
    ],
  },
  {
    title: { es: 'Tormentas severas y tornados (EE. UU.)', en: 'Severe storms and tornadoes (US)' },
    sources: [
      {
        name: 'NOAA Storm Prediction Center (SPC)', url: 'https://www.spc.noaa.gov/',
        covers: { es: 'Pronóstico de tormentas severas del día (categorías de 1 a 5) y reportes preliminares de tornados, viento dañino y granizo en EE. UU.', en: 'Day-1 severe thunderstorm outlook (categories 1 to 5) and preliminary reports of tornadoes, damaging wind and hail in the US.' },
        freq: { es: 'Pronóstico 5 veces por día; reportes casi en tiempo real. Acá se consulta cada 10 minutos.', en: 'Outlook 5 times a day; reports in near real time. Queried here every 10 minutes.' },
        license: USPD('NOAA'),
        limits: { es: 'Solo EE. UU. Los reportes no están verificados (puede haber duplicados) y la categoría EF de un tornado se asigna días después.', en: 'US only. Reports are unverified (duplicates are possible) and a tornado’s EF rating is assigned days later.' },
      },
      {
        name: 'NOAA National Weather Service · avisos (api.weather.gov)', url: 'https://www.weather.gov/documentation/services-web-api',
        covers: { es: 'Avisos vigentes de tornado y de tormenta severa, con su polígono.', en: 'Active tornado and severe thunderstorm warnings, with their polygons.' },
        freq: { es: 'En tiempo real; acá, cada 10 minutos (más hasta 5 de caché).', en: 'Real time; here every 10 minutes (plus up to 5 of caching).' },
        license: USPD('NOAA'),
        limits: { es: 'Puede haber hasta 15 minutos de demora respecto del aviso original: no usar para decidir si refugiarse; para eso, las fuentes del NWS.', en: 'May lag the original warning by up to 15 minutes: do not use it to decide whether to take shelter; use NWS sources for that.' },
      },
    ],
  },
  {
    title: { es: 'Alertas meteorológicas (Argentina)', en: 'Weather alerts (Argentina)' },
    sources: [
      {
        name: 'Servicio Meteorológico Nacional (SMN) · alertas en formato CAP', url: 'https://www.smn.gob.ar/alertas',
        covers: { es: 'Alertas amarillas, naranjas y rojas del Sistema de Alerta Temprana (tormentas, lluvias, viento, nieve y otros fenómenos), vigentes y de los próximos días, con su zona, el texto oficial y qué hacer. Se muestran en el mapa y en «Mi lugar»; las naranjas y rojas, también como aviso y notificación.', en: 'Yellow, orange and red alerts from the Early Warning System (thunderstorms, rain, wind, snow and other hazards), current and for the next days, with their area, official text and advice. Shown on the map and in “My place”; orange and red ones also as alerts and notifications.' },
        freq: { es: 'El SMN las emite y actualiza varias veces por día; acá se leen cada 10 minutos.', en: 'The SMN issues and updates them several times a day; read here every 10 minutes.' },
        license: { es: 'Formato CAP (Common Alerting Protocol), pensado para que las alertas se difundan tal como las emite el organismo. Se reproduce el texto sin cambios, se cita al SMN y se enlaza su sitio.', en: 'CAP (Common Alerting Protocol) format, designed for alerts to be redistributed as issued. The text is reproduced unchanged, the SMN is credited and its site is linked.' },
        limits: { es: 'Puede haber hasta 15 minutos de demora respecto del SMN. Dentro de la zona, el fenómeno puede darse solo en algunos lugares. Ante una emergencia, seguí las indicaciones del SMN y de Defensa Civil.', en: 'May lag the SMN by up to 15 minutes. Within the area, the hazard may occur only in some places. In an emergency, follow the SMN and civil protection authorities.' },
      },
    ],
  },
  {
    title: { es: 'Calor y frío extremos', en: 'Extreme heat and cold' },
    sources: [
      {
        name: 'OMM · Severe Weather Information Centre y servicios nacionales', url: 'https://severeweather.wmo.int/',
        covers: { es: 'Solo enlaces: no hay una fuente oficial abierta y global de alertas de calor o frío, porque cada país define sus umbrales.', en: 'Links only: there is no open, global official source of heat or cold warnings, because each country sets its own thresholds.' },
        freq: { es: 'Según cada servicio.', en: 'Depends on each service.' },
        license: { es: 'No se reproducen datos: solo se enlaza.', en: 'No data is reproduced: links only.' },
        limits: { es: 'Por eso no se muestran en el mapa; el artículo de Aprender enlaza a quienes emiten las alertas.', en: 'That is why they are not mapped; the Learn article links to those who issue the warnings.' },
      },
    ],
  },
];

/** Interpretaciones propias: cálculos del sitio a partir de datos oficiales, siempre rotulados en la ficha. */
export const INTERPRETATIONS: Record<Lang, { h: string; p: string }[]> = {
  es: [
    { h: 'Tipo de falla', p: 'Se clasifica con la inclinación de los ejes del tensor de momento de USGS (Frohlich, 1992): inversa si el eje T supera 50°, normal si el eje P supera 60°, de rumbo si el eje B supera 60°; si no, oblicua. La "pelota de playa" se dibuja con los planos nodales publicados.' },
    { h: 'Placas y velocidad relativa', p: 'La placa se obtiene ubicando el epicentro en los polígonos de PB2002 y el borde más cercano, con su tipo. La velocidad relativa entre las dos placas en ese punto se calcula con los polos de NNR-MORVEL56.' },
    { h: 'Relación con la losa de subducción', p: 'La profundidad de la losa se interpola entre las curvas de Slab2; si el punto está a más de 60 km de una curva, no se estima. Si el sismo está a 15 km o menos de la losa, se considera "en el contacto entre placas" (hasta 70 km de profundidad) o "dentro de la placa que se hunde" (más hondo); más de 15 km por debajo, "dentro de la placa que se hunde"; más de 15 km por encima y a 40 km o menos, "en la corteza"; en otro caso, "no se puede saber". Es una orientación, no una determinación sismológica.' },
    { h: 'Corte transversal', p: 'Perfil en la dirección en que se hunde la losa (de la curva más superficial a la más profunda cercanas), de 250 km antes a 350 km después del epicentro. Se proyectan las réplicas que están a 100 km o menos de esa línea.' },
    { h: 'Historial y volcán cercanos', p: 'Sismos y tsunamis históricos de NCEI a 300 km o menos; volcán del Holoceno de GVP a 30 km o menos del evento; ciclones de IBTrACS que pasaron a unos 300 km o menos.' },
    { h: 'Ambiente del volcán y filtro del mapa', p: 'Se agrupan las categorías de ambiente tectónico de GVP en subducción, rift e intraplaca. El tipo de corteza y de roca son los que publica GVP.' },
    { h: 'Nombre del ciclón según la región', p: 'Huracán, tifón o ciclón se elige por la posición de la tormenta, según la cuenca. Los colores de Saffir-Simpson se aplican al viento informado; la categoría oficial solo la asigna NHC en sus cuencas.' },
    { h: 'Clase de FWI', p: 'En la ficha se usan las clases de EFFIS (muy bajo menos de 5,2; bajo hasta 11,2; moderado hasta 21,3; alto hasta 38; muy alto hasta 50; extremo desde 50). En el mapa, los colores y clases son los de la leyenda oficial del mapa de GWIS.' },
    { h: 'Nivel y tendencia de sequía (GDO)', p: 'Como el servicio no entrega el valor, se lee el color del píxel del mapa oficial en el punto y se lo asigna a la clase de su leyenda. La tendencia compara con la década anterior.' },
    { h: 'Lugares y traducciones', p: 'Los lugares de los mensajes de tsunami se traducen (millas a km) con el texto original debajo. Si está activada, la traducción del resumen tectónico de USGS es automática (IA) y se rotula así; vale el original. Cada resumen se traduce una sola vez y queda guardado, con un tope de 200 traducciones nuevas por mes; pasado el tope se muestra el original en inglés.' },
    { h: 'Posición de algunos eventos de EONET', p: 'Muchas áreas de inundación que EONET toma de GDACS llegan con latitud y longitud invertidas. Se detecta cuando la "latitud" pasa de 90° o cuando, al invertirlas, el punto cae en el país que nombra el título (o más cerca de él); en ese caso se usan invertidas. Además se corrige el sentido de los vértices antes de calcular el centro. Los registros guardados se volvieron a pedir a EONET y se recalcularon.' },
    { h: 'Peligro de deslizamientos (LHASA)', p: 'El mapa pinta la probabilidad de LHASA con la rampa de colores del visor de NASA (azul, celeste, amarillo, rojo) y no muestra valores menores a 5 %, para que se vea el resto del mapa. La opacidad aumenta con la probabilidad hasta 50 %.' },
    { h: 'Hora de los reportes de SPC', p: 'SPC publica la hora (UTC) sin fecha, dentro de un "día" que va de 12 a 12 UTC; las horas anteriores a las 12 se asignan al día calendario siguiente.' },
  ],
  en: [
    { h: 'Fault type', p: 'Classified from the plunge of the USGS moment tensor axes (Frohlich, 1992): reverse if the T axis exceeds 50°, normal if the P axis exceeds 60°, strike-slip if the B axis exceeds 60°; otherwise oblique. The "beach ball" is drawn from the published nodal planes.' },
    { h: 'Plates and relative velocity', p: 'The plate comes from locating the epicenter in the PB2002 polygons, plus the nearest boundary and its type. The relative velocity between the two plates at that point is computed from the NNR-MORVEL56 poles.' },
    { h: 'Relation to the subducting slab', p: 'Slab depth is interpolated between Slab2 contours; if the point is more than 60 km from a contour, it is not estimated. A quake within 15 km of the slab is considered "at the plate interface" (down to 70 km depth) or "inside the sinking plate" (deeper); more than 15 km below, "inside the sinking plate"; more than 15 km above and 40 km deep or less, "in the crust"; otherwise, "cannot tell". It is guidance, not a seismological determination.' },
    { h: 'Cross-section', p: 'Profile in the direction the slab sinks (from the shallowest to the deepest nearby contour), from 250 km before to 350 km after the epicenter. Aftershocks within 100 km of the line are projected onto it.' },
    { h: 'Nearby history and volcano', p: 'NCEI historical earthquakes and tsunamis within 300 km; GVP Holocene volcano within 30 km of the event; IBTrACS cyclones that passed within about 300 km.' },
    { h: 'Volcano setting and map filter', p: 'GVP tectonic setting categories are grouped into subduction, rift and intraplate. Crust and rock type are as published by GVP.' },
    { h: 'Cyclone name by region', p: 'Hurricane, typhoon or cyclone is chosen from the storm position, by basin. Saffir-Simpson colors are applied to the reported wind; the official category is only assigned by NHC in its basins.' },
    { h: 'FWI class', p: 'The page uses the EFFIS classes (very low under 5.2; low to 11.2; moderate to 21.3; high to 38; very high to 50; extreme from 50). On the map, colors and classes are those of the official GWIS map legend.' },
    { h: 'Drought level and trend (GDO)', p: 'Since the service does not return the value, the color of the official map pixel at the point is read and matched to its legend class. The trend compares with the previous dekad.' },
    { h: 'Places and translations', p: 'Places in tsunami messages are translated (miles to km) with the original text below. When enabled, the translation of the USGS tectonic summary is automatic (AI) and labeled as such; the original prevails. Each summary is translated only once and stored, with a cap of 200 new translations per month; beyond it the English original is shown.' },
    { h: 'Position of some EONET events', p: 'Many flood areas that EONET takes from GDACS arrive with latitude and longitude swapped. This is detected when the "latitude" exceeds 90° or when, once swapped, the point falls in (or nearer to) the country named in the title; in that case the swapped order is used. Vertex order is also fixed before computing the center. Stored records were fetched again from EONET and recomputed.' },
    { h: 'Landslide hazard (LHASA)', p: 'The map paints the LHASA probability with the NASA viewer color ramp (blue, cyan, yellow, red) and hides values below 5% so the rest of the map stays visible. Opacity increases with probability up to 50%.' },
    { h: 'Time of SPC reports', p: 'SPC publishes the time (UTC) without a date, within a "day" running from 12 to 12 UTC; times before 12 are assigned to the next calendar day.' },
  ],
};
