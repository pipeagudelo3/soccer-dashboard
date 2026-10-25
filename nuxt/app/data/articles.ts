import type { ArticleInterface } from '#shared/interfaces/ArticleInterface';

export const articles: readonly ArticleInterface[] = [
  {
    category: 'Análisis',
    paragraphs: [
      'Una tabla de posiciones resume resultados, pero no cuenta todo lo que ocurrió en la cancha. Para interpretarla, empieza por los partidos jugados: comparar puntos sin considerar cuántas veces compitió cada equipo puede llevar a conclusiones equivocadas.',
      'En un torneo que concede tres puntos por victoria y uno por empate, los puntos por partido permiten comparar equipos con calendarios distintos. Esta razón describe el rendimiento observado; no garantiza que el equipo mantenga ese ritmo.',
      'La diferencia de goles añade contexto a los puntos. Un balance positivo indica que se marcaron más goles de los que se recibieron, pero las reglas de desempate dependen de cada competición. Revisa siempre el reglamento antes de decidir qué equipo ocupa una posición.',
    ],
    publishedDate: '2026-10-01',
    slug: 'leer-la-tabla',
    summary: 'Puntos, partidos y diferencia de goles: tres datos que conviene leer juntos.',
    title: 'Cómo leer una tabla de posiciones',
  },
  {
    category: 'Equipos',
    paragraphs: [
      'El nombre identifica a un equipo para el aficionado; un identificador estable permite relacionarlo con jugadores y partidos dentro de una aplicación. Si el club cambia de nombre, esas relaciones deben seguir apuntando al mismo registro.',
      'El país, el estadio y la fecha de fundación aportan contexto al perfil. Son datos distintos del desempeño deportivo: un estadio grande o una larga historia no implican una posición concreta en la tabla.',
      'En este catálogo utilizamos equipos ficticios para practicar la consulta de perfiles sin depender de un proveedor externo. La ficha de cada equipo conserva el mismo identificador al pasar del listado al detalle.',
    ],
    publishedDate: '2026-10-08',
    slug: 'conocer-un-equipo',
    summary: 'La identidad de un club va más allá de sus resultados del fin de semana.',
    title: 'Qué nos cuenta la ficha de un equipo',
  },
  {
    category: 'Estadísticas',
    paragraphs: [
      'Un resultado aislado puede estar condicionado por una expulsión, una lesión o una decisión táctica. Para reconocer tendencias, observa una serie de partidos y mantén el mismo criterio de selección durante la comparación.',
      'Al comparar goles, distingue los totales de los promedios. Diez goles en cinco partidos equivalen a dos por partido; diez en diez partidos equivalen a uno. Ambos equipos tienen el mismo total y ritmos diferentes.',
      'Las estadísticas describen lo que se ha registrado. No sustituyen la observación del juego ni explican por sí solas sus causas. Presentar el tamaño de la muestra y el periodo analizado ayuda a comunicar resultados con honestidad.',
    ],
    publishedDate: '2026-10-15',
    slug: 'comparar-con-contexto',
    summary: 'Por qué una cifra necesita un periodo y una muestra para tener sentido.',
    title: 'Comparar estadísticas con contexto',
  },
];
