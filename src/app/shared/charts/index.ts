// ═══════════════════════════════════════════════════════════════════════
// KIT DE GRAPHIQUES
//
// Tout est dessiné en SVG plutôt que confié à une bibliothèque : les couleurs
// sont alors de vrais jetons CSS, donc le passage en thème sombre est gratuit
// et un changement de charte se fait en un endroit. Le kit reste petit parce
// qu'il ne couvre que les formes dont les tableaux de bord ont besoin.
// ═══════════════════════════════════════════════════════════════════════

export * from './chart.models';
export { ChartAreaComponent } from './chart-area.component';
export { ChartBarsComponent } from './chart-bars.component';
export { ChartDonutComponent } from './chart-donut.component';
export { ChartRankingComponent } from './chart-ranking.component';
export { ChartGaugeComponent } from './chart-gauge.component';
export { ChartSparklineComponent } from './chart-sparkline.component';
export { ChartHeatstripComponent } from './chart-heatstrip.component';
export { ChartTooltipComponent } from './chart-tooltip.component';
