import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Title,
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import { Card } from '../../types';
import { Layers, PieChart, DollarSign, Activity } from 'lucide-react';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, Title);

interface AnalyticsProps {
  cards: Array<{ card: Card; quantity: number }>;
  title?: string;
  showDeckMetrics?: boolean;
}

export const InteractiveCharts: React.FC<AnalyticsProps> = ({
  cards,
  title = 'Análise Estatística',
  showDeckMetrics = false,
}) => {
  const stats = useMemo(() => {
    let totalCards = 0;
    let totalValueUsd = 0;
    let cmcSum = 0;
    let nonLandCount = 0;

    const colorsCount = {
      White: 0,
      Blue: 0,
      Black: 0,
      Red: 0,
      Green: 0,
      Colorless: 0,
      Multicolor: 0,
    };

    const typesCount = {
      Criatura: 0,
      Mágica_Instantânea: 0,
      Feitiço: 0,
      Artefato: 0,
      Encantamento: 0,
      Planeswalker: 0,
      Terreno: 0,
      Outros: 0,
    };

    const cmcCurve = [0, 0, 0, 0, 0, 0, 0, 0]; // 0 to 7+
    const rarityCount = {
      comum: 0,
      incomum: 0,
      rara: 0,
      mítica: 0,
    };

    cards.forEach(({ card, quantity }) => {
      totalCards += quantity;
      if (card.priceUsd) {
        totalValueUsd += card.priceUsd * quantity;
      }

      const isLand = card.typeLine.toLowerCase().includes('land') || card.typeLine.toLowerCase().includes('terreno');
      if (!isLand) {
        cmcSum += card.cmc * quantity;
        nonLandCount += quantity;
        const bucket = Math.min(Math.floor(card.cmc), 7);
        cmcCurve[bucket] += quantity;
      }

      // Colors
      const colors = card.colors || [];
      if (colors.length === 0) {
        colorsCount.Colorless += quantity;
      } else if (colors.length === 1) {
        if (colors[0] === 'W') colorsCount.White += quantity;
        else if (colors[0] === 'U') colorsCount.Blue += quantity;
        else if (colors[0] === 'B') colorsCount.Black += quantity;
        else if (colors[0] === 'R') colorsCount.Red += quantity;
        else if (colors[0] === 'G') colorsCount.Green += quantity;
      } else {
        colorsCount.Multicolor += quantity;
      }

      // Types
      const t = card.typeLine.toLowerCase();
      if (t.includes('creature') || t.includes('criatura')) typesCount.Criatura += quantity;
      else if (t.includes('instant') || t.includes('instantânea')) typesCount.Mágica_Instantânea += quantity;
      else if (t.includes('sorcery') || t.includes('feitiço')) typesCount.Feitiço += quantity;
      else if (t.includes('artifact') || t.includes('artefato')) typesCount.Artefato += quantity;
      else if (t.includes('enchantment') || t.includes('encantamento')) typesCount.Encantamento += quantity;
      else if (t.includes('planeswalker')) typesCount.Planeswalker += quantity;
      else if (isLand) typesCount.Terreno += quantity;
      else typesCount.Outros += quantity;

      // Rarity
      const r = card.rarity.toLowerCase();
      if (r === 'mythic' || r === 'mítica') rarityCount.mítica += quantity;
      else if (r === 'rare' || r === 'rara') rarityCount.rara += quantity;
      else if (r === 'uncommon' || r === 'incomum') rarityCount.incomum += quantity;
      else rarityCount.comum += quantity;
    });

    const avgCmc = nonLandCount > 0 ? (cmcSum / nonLandCount).toFixed(2) : '0.00';
    const totalValueBrl = (totalValueUsd * 5.7).toFixed(2); // estimated exchange rate

    return {
      totalCards,
      uniqueCards: cards.length,
      totalValueUsd: totalValueUsd.toFixed(2),
      totalValueBrl,
      avgCmc,
      nonLandCount,
      colorsCount,
      typesCount,
      cmcCurve,
      rarityCount,
    };
  }, [cards]);

  const colorData = {
    labels: ['Branco', 'Azul', 'Preto', 'Vermelho', 'Verde', 'Incolor', 'Multicolor'],
    datasets: [
      {
        data: [
          stats.colorsCount.White,
          stats.colorsCount.Blue,
          stats.colorsCount.Black,
          stats.colorsCount.Red,
          stats.colorsCount.Green,
          stats.colorsCount.Colorless,
          stats.colorsCount.Multicolor,
        ],
        backgroundColor: [
          '#f8f6d8',
          '#38bdf8',
          '#272a30',
          '#f43f5e',
          '#22c55e',
          '#94a3b8',
          '#eab308',
        ],
        borderColor: [
          '#0f141d',
          '#0f141d',
          '#cbd5e1',
          '#0f141d',
          '#0f141d',
          '#0f141d',
          '#0f141d',
        ],
        borderWidth: 2,
      },
    ],
  };

  const cmcData = {
    labels: ['0', '1', '2', '3', '4', '5', '6', '7+'],
    datasets: [
      {
        label: 'Mágicas (Custo de Mana)',
        data: stats.cmcCurve,
        backgroundColor: '#ffbb00',
        hoverBackgroundColor: '#ffd043',
        borderRadius: 4,
      },
    ],
  };

  const typesData = {
    labels: Object.keys(stats.typesCount).map((k) => k.replace('_', ' ')),
    datasets: [
      {
        label: 'Tipos de Carta',
        data: Object.values(stats.typesCount),
        backgroundColor: [
          '#10b981',
          '#38bdf8',
          '#ffbb00',
          '#94a3b8',
          '#ec4899',
          '#a855f7',
          '#84cc16',
          '#71717a',
        ],
        borderRadius: 4,
      },
    ],
  };

  const chartOptionsDark = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 } },
      },
    },
    scales: {
      x: {
        ticks: { color: '#71717a' },
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      y: {
        ticks: { color: '#71717a', precision: 0 },
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
      },
    },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', marginTop: '8px' }}>
      {/* Metric summary badges */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(195px, 1fr))', gap: '20px' }}>
        <div className="glass-card" style={{ padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.82rem' }}>
            <span>Total de Cartas</span>
            <Layers size={16} />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 700, marginTop: '10px', color: '#f8fafc' }}>
            {stats.totalCards}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#71717a', marginTop: '6px' }}>
            {stats.uniqueCards} cartas únicas
          </div>
        </div>

        {showDeckMetrics && (
          <div className="glass-card" style={{ padding: '20px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.82rem' }}>
              <span>Custo Médio (CMC)</span>
              <Activity size={16} />
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 700, marginTop: '10px', color: '#ffbb00' }}>
              {stats.avgCmc}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#71717a', marginTop: '6px' }}>
              Excluindo terrenos
            </div>
          </div>
        )}

        <div className="glass-card" style={{ padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.82rem' }}>
            <span>Valor Estimado</span>
            <DollarSign size={16} />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 700, marginTop: '10px', color: '#10b981' }}>
            ${stats.totalValueUsd}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '6px' }}>
            Aprox. R$ {stats.totalValueBrl}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.82rem' }}>
            <span>Raridades</span>
            <PieChart size={16} />
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
            <span className="badge badge-rarity-mythic">{stats.rarityCount.mítica} M</span>
            <span className="badge badge-rarity-rare">{stats.rarityCount.rara} R</span>
            <span className="badge badge-rarity-uncommon">{stats.rarityCount.incomum} U</span>
            <span className="badge badge-rarity-common">{stats.rarityCount.comum} C</span>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: '24px' }}>
        {/* Mana Curve */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <h3 style={{ fontSize: '0.98rem', fontWeight: 600, marginBottom: '12px', color: '#e2e8f0' }}>
            Curva de Mana
          </h3>
          <div style={{ height: '240px', width: '100%' }}>
            <Bar data={cmcData} options={chartOptionsDark} />
          </div>
        </div>

        {/* Color Breakdown */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <h3 style={{ fontSize: '0.98rem', fontWeight: 600, marginBottom: '12px', color: '#e2e8f0' }}>
            Distribuição de Cores
          </h3>
          <div style={{ height: '240px', width: '100%' }}>
            <Doughnut
              data={colorData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'right',
                    labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 }, boxWidth: 14, padding: 14 },
                  },
                },
              }}
            />
          </div>
        </div>

        {/* Card Types Breakdown */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <h3 style={{ fontSize: '0.98rem', fontWeight: 600, marginBottom: '12px', color: '#e2e8f0' }}>
            Distribuição por Tipos
          </h3>
          <div style={{ height: '240px', width: '100%' }}>
            <Bar
              data={typesData}
              options={{
                ...chartOptionsDark,
                indexAxis: 'y' as const,
                plugins: { legend: { display: false } },
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
