// Analytics dashboard component for MindScribe

import { StoredContent } from '../types/storage';

export interface AnalyticsData {
    totalItems: number;
    thisWeekItems: number;
    thisMonthItems: number;
    mostActiveDay: { date: string; count: number } | null;
    topCategory: { name: string; count: number } | null;
    searchCount: number;
    captureActivity: { date: string; count: number }[];
    categoryDistribution: { category: string; count: number; percentage: number }[];
    readingTimeStats: {
        total: number;
        average: number;
        median: number;
    };
    accessPatterns: {
        mostAccessed: { id: string; title: string; count: number }[];
        recentlyAccessed: { id: string; title: string; lastAccessed: Date }[];
        neverAccessed: { id: string; title: string; timestamp: Date }[];
    };
    contentGrowth: { date: string; cumulative: number }[];
    languageDistribution: { language: string; count: number }[];
    importanceDistribution: { level: number; count: number }[];
}

export interface ChartOptions {
    width: number;
    height: number;
    margin: { top: number; right: number; bottom: number; left: number };
    colors: string[];
}

export class AnalyticsEngine {
    private static instance: AnalyticsEngine | null = null;

    static getInstance(): AnalyticsEngine {
        if (!AnalyticsEngine.instance) {
            AnalyticsEngine.instance = new AnalyticsEngine();
        }
        return AnalyticsEngine.instance;
    }

    generateAnalytics(content: StoredContent[]): AnalyticsData {
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        return {
            totalItems: content.length,
            thisWeekItems: this.countItemsSince(content, oneWeekAgo),
            thisMonthItems: this.countItemsSince(content, oneMonthAgo),
            mostActiveDay: this.findMostActiveDay(content),
            topCategory: this.findTopCategory(content),
            searchCount: this.estimateSearchCount(content),
            captureActivity: this.generateCaptureActivity(content),
            categoryDistribution: this.calculateCategoryDistribution(content),
            readingTimeStats: this.calculateReadingTimeStats(content),
            accessPatterns: this.analyzeAccessPatterns(content),
            contentGrowth: this.calculateContentGrowth(content),
            languageDistribution: this.calculateLanguageDistribution(content),
            importanceDistribution: this.calculateImportanceDistribution(content)
        };
    }

    private countItemsSince(content: StoredContent[], since: Date): number {
        return content.filter(item => new Date(item.timestamp) >= since).length;
    }

    private findMostActiveDay(content: StoredContent[]): { date: string; count: number } | null {
        const dailyCounts = new Map<string, number>();

        content.forEach(item => {
            const date = new Date(item.timestamp).toDateString();
            dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1);
        });

        if (dailyCounts.size === 0) return null;

        const mostActive = Array.from(dailyCounts.entries())
            .sort((a, b) => b[1] - a[1])[0];

        return {
            date: mostActive[0],
            count: mostActive[1]
        };
    }

    private findTopCategory(content: StoredContent[]): { name: string; count: number } | null {
        const categoryCounts = new Map<string, number>();

        content.forEach(item => {
            const category = item.category || 'other';
            categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
        });

        if (categoryCounts.size === 0) return null;

        const topCategory = Array.from(categoryCounts.entries())
            .sort((a, b) => b[1] - a[1])[0];

        return {
            name: topCategory[0],
            count: topCategory[1]
        };
    }

    private estimateSearchCount(content: StoredContent[]): number {
        // Estimate based on content access patterns
        const totalAccesses = content.reduce((sum, item) => sum + item.timesAccessed, 0);
        return Math.floor(totalAccesses * 0.3); // Assume 30% of accesses are via search
    }

    private generateCaptureActivity(content: StoredContent[]): { date: string; count: number }[] {
        const activity: { date: string; count: number }[] = [];
        const now = new Date();

        // Generate last 30 days
        for (let i = 29; i >= 0; i--) {
            const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const dateStr = date.toISOString().split('T')[0];

            const dayContent = content.filter(item => {
                const itemDate = new Date(item.timestamp).toISOString().split('T')[0];
                return itemDate === dateStr;
            });

            activity.push({
                date: dateStr,
                count: dayContent.length
            });
        }

        return activity;
    }

    private calculateCategoryDistribution(content: StoredContent[]): { category: string; count: number; percentage: number }[] {
        const categoryCounts = new Map<string, number>();

        content.forEach(item => {
            const category = item.category || 'other';
            categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
        });

        const total = content.length;
        return Array.from(categoryCounts.entries())
            .map(([category, count]) => ({
                category,
                count,
                percentage: total > 0 ? (count / total) * 100 : 0
            }))
            .sort((a, b) => b.count - a.count);
    }

    private calculateReadingTimeStats(content: StoredContent[]): {
        total: number;
        average: number;
        median: number;
    } {
        const readingTimes = content
            .map(item => item.metadata.readingTime || 0)
            .filter(time => time > 0);

        if (readingTimes.length === 0) {
            return { total: 0, average: 0, median: 0 };
        }

        const total = readingTimes.reduce((sum, time) => sum + time, 0);
        const average = total / readingTimes.length;

        const sorted = [...readingTimes].sort((a, b) => a - b);
        const median = sorted.length % 2 === 0
            ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
            : sorted[Math.floor(sorted.length / 2)];

        return { total, average, median };
    }

    private analyzeAccessPatterns(content: StoredContent[]): {
        mostAccessed: { id: string; title: string; count: number }[];
        recentlyAccessed: { id: string; title: string; lastAccessed: Date }[];
        neverAccessed: { id: string; title: string; timestamp: Date }[];
    } {
        // Most accessed content
        const mostAccessed = content
            .filter(item => item.timesAccessed > 0)
            .sort((a, b) => b.timesAccessed - a.timesAccessed)
            .slice(0, 10)
            .map(item => ({
                id: item.id,
                title: item.title,
                count: item.timesAccessed
            }));

        // Recently accessed content
        const recentlyAccessed = content
            .filter(item => item.timesAccessed > 0)
            .sort((a, b) => new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime())
            .slice(0, 10)
            .map(item => ({
                id: item.id,
                title: item.title,
                lastAccessed: new Date(item.lastAccessed)
            }));

        // Never accessed content
        const neverAccessed = content
            .filter(item => item.timesAccessed === 0)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 10)
            .map(item => ({
                id: item.id,
                title: item.title,
                timestamp: new Date(item.timestamp)
            }));

        return { mostAccessed, recentlyAccessed, neverAccessed };
    }

    private calculateContentGrowth(content: StoredContent[]): { date: string; cumulative: number }[] {
        const sortedContent = content
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        const growth: { date: string; cumulative: number }[] = [];
        let cumulative = 0;

        // Group by date and calculate cumulative count
        const dateGroups = new Map<string, number>();
        sortedContent.forEach(item => {
            const date = new Date(item.timestamp).toISOString().split('T')[0];
            dateGroups.set(date, (dateGroups.get(date) || 0) + 1);
        });

        // Generate cumulative growth
        Array.from(dateGroups.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .forEach(([date, count]) => {
                cumulative += count;
                growth.push({ date, cumulative });
            });

        return growth;
    }

    private calculateLanguageDistribution(content: StoredContent[]): { language: string; count: number }[] {
        const languageCounts = new Map<string, number>();

        content.forEach(item => {
            const language = item.metadata.language || 'unknown';
            languageCounts.set(language, (languageCounts.get(language) || 0) + 1);
        });

        return Array.from(languageCounts.entries())
            .map(([language, count]) => ({ language, count }))
            .sort((a, b) => b.count - a.count);
    }

    private calculateImportanceDistribution(content: StoredContent[]): { level: number; count: number }[] {
        const importanceCounts = new Map<number, number>();

        content.forEach(item => {
            const importance = Math.floor(item.importance || 5);
            importanceCounts.set(importance, (importanceCounts.get(importance) || 0) + 1);
        });

        return Array.from(importanceCounts.entries())
            .map(([level, count]) => ({ level, count }))
            .sort((a, b) => a.level - b.level);
    }
}

export class ChartRenderer {
    private container: HTMLElement;
    private options: ChartOptions;

    constructor(container: HTMLElement, options: Partial<ChartOptions> = {}) {
        this.container = container;
        this.options = {
            width: 400,
            height: 200,
            margin: { top: 20, right: 20, bottom: 40, left: 40 },
            colors: ['#4285f4', '#34a853', '#ea4335', '#fbbc04', '#9aa0a6'],
            ...options
        };
    }

    renderLineChart(data: { date: string; count: number }[], title: string): void {
        this.container.innerHTML = '';

        if (data.length === 0) {
            this.renderEmptyChart(title);
            return;
        }

        const svg = this.createSVG();
        const { width, height, margin } = this.options;
        const chartWidth = width - margin.left - margin.right;
        const chartHeight = height - margin.top - margin.bottom;

        // Create scales
        const maxCount = Math.max(...data.map(d => d.count));
        const xScale = (index: number) => (index / (data.length - 1)) * chartWidth;
        const yScale = (value: number) => chartHeight - (value / maxCount) * chartHeight;

        // Create chart group
        const chartGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        chartGroup.setAttribute('transform', `translate(${margin.left}, ${margin.top})`);

        // Draw axes
        this.drawAxes(chartGroup, chartWidth, chartHeight);

        // Draw line
        const pathData = data.map((d, i) => {
            const x = xScale(i);
            const y = yScale(d.count);
            return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
        }).join(' ');

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathData);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', this.options.colors[0]);
        path.setAttribute('stroke-width', '2');
        chartGroup.appendChild(path);

        // Draw points
        data.forEach((d, i) => {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', xScale(i).toString());
            circle.setAttribute('cy', yScale(d.count).toString());
            circle.setAttribute('r', '3');
            circle.setAttribute('fill', this.options.colors[0]);

            // Add tooltip
            const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
            title.textContent = `${d.date}: ${d.count} items`;
            circle.appendChild(title);

            chartGroup.appendChild(circle);
        });

        svg.appendChild(chartGroup);
        this.container.appendChild(svg);
    }

    renderBarChart(data: { category: string; count: number }[], title: string): void {
        this.container.innerHTML = '';

        if (data.length === 0) {
            this.renderEmptyChart(title);
            return;
        }

        const svg = this.createSVG();
        const { width, height, margin } = this.options;
        const chartWidth = width - margin.left - margin.right;
        const chartHeight = height - margin.top - margin.bottom;

        // Create scales
        const maxCount = Math.max(...data.map(d => d.count));
        const barWidth = chartWidth / data.length * 0.8;
        const barSpacing = chartWidth / data.length * 0.2;

        // Create chart group
        const chartGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        chartGroup.setAttribute('transform', `translate(${margin.left}, ${margin.top})`);

        // Draw axes
        this.drawAxes(chartGroup, chartWidth, chartHeight);

        // Draw bars
        data.forEach((d, i) => {
            const x = i * (barWidth + barSpacing) + barSpacing / 2;
            const barHeight = (d.count / maxCount) * chartHeight;
            const y = chartHeight - barHeight;

            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', x.toString());
            rect.setAttribute('y', y.toString());
            rect.setAttribute('width', barWidth.toString());
            rect.setAttribute('height', barHeight.toString());
            rect.setAttribute('fill', this.options.colors[i % this.options.colors.length]);

            // Add tooltip
            const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
            title.textContent = `${d.category}: ${d.count} items`;
            rect.appendChild(title);

            chartGroup.appendChild(rect);

            // Add label
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', (x + barWidth / 2).toString());
            text.setAttribute('y', (chartHeight + 15).toString());
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('font-size', '10');
            text.setAttribute('fill', '#5f6368');
            text.textContent = d.category.length > 8 ? d.category.substring(0, 8) + '...' : d.category;
            chartGroup.appendChild(text);
        });

        svg.appendChild(chartGroup);
        this.container.appendChild(svg);
    }

    renderPieChart(data: { category: string; count: number; percentage: number }[], title: string): void {
        this.container.innerHTML = '';

        if (data.length === 0) {
            this.renderEmptyChart(title);
            return;
        }

        const svg = this.createSVG();
        const { width, height } = this.options;
        const radius = Math.min(width, height) / 2 - 40;
        const centerX = width / 2;
        const centerY = height / 2;

        let currentAngle = 0;

        data.forEach((d, i) => {
            const angle = (d.percentage / 100) * 2 * Math.PI;
            const endAngle = currentAngle + angle;

            // Create arc path
            const largeArcFlag = angle > Math.PI ? 1 : 0;
            const x1 = centerX + radius * Math.cos(currentAngle);
            const y1 = centerY + radius * Math.sin(currentAngle);
            const x2 = centerX + radius * Math.cos(endAngle);
            const y2 = centerY + radius * Math.sin(endAngle);

            const pathData = [
                `M ${centerX} ${centerY}`,
                `L ${x1} ${y1}`,
                `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                'Z'
            ].join(' ');

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', pathData);
            path.setAttribute('fill', this.options.colors[i % this.options.colors.length]);
            path.setAttribute('stroke', '#fff');
            path.setAttribute('stroke-width', '2');

            // Add tooltip
            const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
            title.textContent = `${d.category}: ${d.count} items (${d.percentage.toFixed(1)}%)`;
            path.appendChild(title);

            svg.appendChild(path);

            currentAngle = endAngle;
        });

        this.container.appendChild(svg);
    }

    private createSVG(): SVGSVGElement {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', this.options.width.toString());
        svg.setAttribute('height', this.options.height.toString());
        svg.style.background = '#fff';
        return svg;
    }

    private drawAxes(group: SVGGElement, width: number, height: number): void {
        // X-axis
        const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        xAxis.setAttribute('x1', '0');
        xAxis.setAttribute('y1', height.toString());
        xAxis.setAttribute('x2', width.toString());
        xAxis.setAttribute('y2', height.toString());
        xAxis.setAttribute('stroke', '#dadce0');
        group.appendChild(xAxis);

        // Y-axis
        const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        yAxis.setAttribute('x1', '0');
        yAxis.setAttribute('y1', '0');
        yAxis.setAttribute('x2', '0');
        yAxis.setAttribute('y2', height.toString());
        yAxis.setAttribute('stroke', '#dadce0');
        group.appendChild(yAxis);
    }

    private renderEmptyChart(title: string): void {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.justifyContent = 'center';
        div.style.height = this.options.height + 'px';
        div.style.color = '#5f6368';
        div.style.fontSize = '14px';
        div.textContent = 'No data available';
        this.container.appendChild(div);
    }
}