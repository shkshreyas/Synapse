// Interactive knowledge graph visualization component

export interface GraphNode {
    id: string;
    title: string;
    category: string;
    importance: number;
    timesAccessed: number;
    concepts: string[];
    position: { x: number; y: number };
    size?: number;
    color?: string;
}

export interface GraphEdge {
    source: string;
    target: string;
    type: 'similar' | 'builds_on' | 'contradicts' | 'references' | 'related';
    strength: number;
    confidence: number;
}

export interface GraphCluster {
    id: string;
    name: string;
    nodes: string[];
    color: string;
    center?: { x: number; y: number };
}

export interface KnowledgeGraphOptions {
    width: number;
    height: number;
    nodeMinSize: number;
    nodeMaxSize: number;
    showLabels: boolean;
    showClusters: boolean;
    enableDrag: boolean;
    enableZoom: boolean;
    onNodeClick?: (nodeId: string) => void;
    onNodeHover?: (nodeId: string | null) => void;
}

export class InteractiveKnowledgeGraph {
    private container: HTMLElement;
    private svg: SVGSVGElement;
    private options: KnowledgeGraphOptions;
    private nodes: GraphNode[] = [];
    private edges: GraphEdge[] = [];
    private clusters: GraphCluster[] = [];

    private scale: number = 1;
    private translateX: number = 0;
    private translateY: number = 0;
    private isDragging: boolean = false;
    private dragNode: GraphNode | null = null;
    private dragOffset: { x: number; y: number } = { x: 0, y: 0 };

    constructor(container: HTMLElement, options: Partial<KnowledgeGraphOptions> = {}) {
        this.container = container;
        this.options = {
            width: 800,
            height: 600,
            nodeMinSize: 8,
            nodeMaxSize: 24,
            showLabels: true,
            showClusters: true,
            enableDrag: true,
            enableZoom: true,
            ...options
        };

        this.initializeSVG();
        this.setupEventListeners();
    }

    private initializeSVG(): void {
        // Clear container
        this.container.innerHTML = '';

        // Create SVG
        this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.svg.setAttribute('width', '100%');
        this.svg.setAttribute('height', '100%');
        this.svg.setAttribute('viewBox', `0 0 ${this.options.width} ${this.options.height}`);
        this.svg.style.background = '#f8f9fa';
        this.svg.style.cursor = 'grab';

        // Create groups for different elements
        const defsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const clustersGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const edgesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const nodesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const labelsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');

        clustersGroup.setAttribute('class', 'clusters');
        edgesGroup.setAttribute('class', 'edges');
        nodesGroup.setAttribute('class', 'nodes');
        labelsGroup.setAttribute('class', 'labels');

        // Add gradients for nodes
        this.createGradients(defsGroup);

        this.svg.appendChild(defsGroup);
        this.svg.appendChild(clustersGroup);
        this.svg.appendChild(edgesGroup);
        this.svg.appendChild(nodesGroup);
        this.svg.appendChild(labelsGroup);

        this.container.appendChild(this.svg);
    }

    private createGradients(defsGroup: SVGDefsElement): void {
        const categories = ['article', 'documentation', 'video', 'social', 'other'];
        const colors = {
            article: '#4285f4',
            documentation: '#34a853',
            video: '#ea4335',
            social: '#fbbc04',
            other: '#9aa0a6'
        };

        categories.forEach(category => {
            const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'radialGradient');
            gradient.setAttribute('id', `gradient-${category}`);
            gradient.setAttribute('cx', '30%');
            gradient.setAttribute('cy', '30%');

            const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
            stop1.setAttribute('offset', '0%');
            stop1.setAttribute('stop-color', this.lightenColor(colors[category as keyof typeof colors], 20));

            const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
            stop2.setAttribute('offset', '100%');
            stop2.setAttribute('stop-color', colors[category as keyof typeof colors]);

            gradient.appendChild(stop1);
            gradient.appendChild(stop2);
            defsGroup.appendChild(gradient);
        });
    }

    private lightenColor(color: string, percent: number): string {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;
        return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    }

    private setupEventListeners(): void {
        if (this.options.enableZoom) {
            this.svg.addEventListener('wheel', (e) => {
                e.preventDefault();
                this.handleZoom(e);
            });
        }

        if (this.options.enableDrag) {
            this.svg.addEventListener('mousedown', (e) => this.handleMouseDown(e));
            this.svg.addEventListener('mousemove', (e) => this.handleMouseMove(e));
            this.svg.addEventListener('mouseup', (e) => this.handleMouseUp(e));
            this.svg.addEventListener('mouseleave', (e) => this.handleMouseUp(e));
        }
    }

    public setData(nodes: GraphNode[], edges: GraphEdge[], clusters: GraphCluster[] = []): void {
        this.nodes = nodes.map(node => ({
            ...node,
            size: this.calculateNodeSize(node),
            color: this.getCategoryColor(node.category)
        }));
        this.edges = edges;
        this.clusters = clusters;

        this.render();
    }

    private calculateNodeSize(node: GraphNode): number {
        const { nodeMinSize, nodeMaxSize } = this.options;
        const maxImportance = Math.max(...this.nodes.map(n => n.importance || 5));
        const minImportance = Math.min(...this.nodes.map(n => n.importance || 1));

        const normalizedImportance = (node.importance - minImportance) / (maxImportance - minImportance);
        return nodeMinSize + (normalizedImportance * (nodeMaxSize - nodeMinSize));
    }

    private getCategoryColor(category: string): string {
        const colors: Record<string, string> = {
            article: '#4285f4',
            documentation: '#34a853',
            video: '#ea4335',
            social: '#fbbc04',
            other: '#9aa0a6'
        };
        return colors[category] || colors.other;
    }

    private render(): void {
        this.renderClusters();
        this.renderEdges();
        this.renderNodes();
        if (this.options.showLabels) {
            this.renderLabels();
        }
    }

    private renderClusters(): void {
        const clustersGroup = this.svg.querySelector('.clusters') as SVGGElement;
        if (!clustersGroup || !this.options.showClusters) return;

        clustersGroup.innerHTML = '';

        this.clusters.forEach(cluster => {
            const clusterNodes = this.nodes.filter(node => cluster.nodes.includes(node.id));
            if (clusterNodes.length < 2) return;

            // Calculate cluster bounds
            const bounds = this.calculateClusterBounds(clusterNodes);
            const padding = 30;

            // Create cluster background
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', (bounds.minX - padding).toString());
            rect.setAttribute('y', (bounds.minY - padding).toString());
            rect.setAttribute('width', (bounds.width + 2 * padding).toString());
            rect.setAttribute('height', (bounds.height + 2 * padding).toString());
            rect.setAttribute('fill', cluster.color);
            rect.setAttribute('fill-opacity', '0.1');
            rect.setAttribute('stroke', cluster.color);
            rect.setAttribute('stroke-width', '2');
            rect.setAttribute('stroke-dasharray', '5,5');
            rect.setAttribute('rx', '10');

            clustersGroup.appendChild(rect);

            // Add cluster label
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', (bounds.minX - padding + 10).toString());
            text.setAttribute('y', (bounds.minY - padding + 20).toString());
            text.setAttribute('font-size', '12');
            text.setAttribute('font-weight', 'bold');
            text.setAttribute('fill', cluster.color);
            text.textContent = cluster.name;

            clustersGroup.appendChild(text);
        });
    }

    private calculateClusterBounds(nodes: GraphNode[]): {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
        width: number;
        height: number;
    } {
        const positions = nodes.map(node => node.position);
        const minX = Math.min(...positions.map(p => p.x));
        const minY = Math.min(...positions.map(p => p.y));
        const maxX = Math.max(...positions.map(p => p.x));
        const maxY = Math.max(...positions.map(p => p.y));

        return {
            minX,
            minY,
            maxX,
            maxY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    private renderEdges(): void {
        const edgesGroup = this.svg.querySelector('.edges') as SVGGElement;
        if (!edgesGroup) return;

        edgesGroup.innerHTML = '';

        this.edges.forEach(edge => {
            const sourceNode = this.nodes.find(n => n.id === edge.source);
            const targetNode = this.nodes.find(n => n.id === edge.target);

            if (!sourceNode || !targetNode) return;

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', sourceNode.position.x.toString());
            line.setAttribute('y1', sourceNode.position.y.toString());
            line.setAttribute('x2', targetNode.position.x.toString());
            line.setAttribute('y2', targetNode.position.y.toString());
            line.setAttribute('stroke', this.getEdgeColor(edge.type));
            line.setAttribute('stroke-width', Math.max(1, edge.strength * 4).toString());
            line.setAttribute('opacity', (edge.confidence * 0.8 + 0.2).toString());
            line.setAttribute('stroke-linecap', 'round');

            // Add edge type styling
            if (edge.type === 'contradicts') {
                line.setAttribute('stroke-dasharray', '5,5');
            }

            // Add title for hover
            const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
            title.textContent = `${edge.type} (strength: ${edge.strength.toFixed(2)}, confidence: ${edge.confidence.toFixed(2)})`;
            line.appendChild(title);

            edgesGroup.appendChild(line);
        });
    }

    private getEdgeColor(type: string): string {
        const colors: Record<string, string> = {
            similar: '#4285f4',
            builds_on: '#34a853',
            contradicts: '#ea4335',
            references: '#fbbc04',
            related: '#9aa0a6'
        };
        return colors[type] || colors.related;
    }

    private renderNodes(): void {
        const nodesGroup = this.svg.querySelector('.nodes') as SVGGElement;
        if (!nodesGroup) return;

        nodesGroup.innerHTML = '';

        this.nodes.forEach(node => {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', node.position.x.toString());
            circle.setAttribute('cy', node.position.y.toString());
            circle.setAttribute('r', (node.size || 10).toString());
            circle.setAttribute('fill', `url(#gradient-${node.category})`);
            circle.setAttribute('stroke', '#fff');
            circle.setAttribute('stroke-width', '2');
            circle.style.cursor = 'pointer';

            // Add importance indicator
            if (node.importance > 7) {
                circle.setAttribute('stroke', '#ffd700');
                circle.setAttribute('stroke-width', '3');
            }

            // Add access frequency indicator
            const accessRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            accessRing.setAttribute('cx', node.position.x.toString());
            accessRing.setAttribute('cy', node.position.y.toString());
            accessRing.setAttribute('r', ((node.size || 10) + 4).toString());
            accessRing.setAttribute('fill', 'none');
            accessRing.setAttribute('stroke', node.color || '#9aa0a6');
            accessRing.setAttribute('stroke-width', '1');
            accessRing.setAttribute('opacity', Math.min(node.timesAccessed / 10, 1).toString());

            // Add title for hover
            const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
            title.textContent = `${node.title}\nCategory: ${node.category}\nImportance: ${node.importance}\nAccessed: ${node.timesAccessed} times`;
            circle.appendChild(title);

            // Add event listeners
            circle.addEventListener('click', () => {
                if (this.options.onNodeClick) {
                    this.options.onNodeClick(node.id);
                }
            });

            circle.addEventListener('mouseenter', () => {
                if (this.options.onNodeHover) {
                    this.options.onNodeHover(node.id);
                }
                this.highlightNode(node.id);
            });

            circle.addEventListener('mouseleave', () => {
                if (this.options.onNodeHover) {
                    this.options.onNodeHover(null);
                }
                this.clearHighlight();
            });

            // Add drag functionality
            if (this.options.enableDrag) {
                circle.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                    this.startNodeDrag(node, e);
                });
            }

            nodesGroup.appendChild(accessRing);
            nodesGroup.appendChild(circle);
        });
    }

    private renderLabels(): void {
        const labelsGroup = this.svg.querySelector('.labels') as SVGGElement;
        if (!labelsGroup) return;

        labelsGroup.innerHTML = '';

        this.nodes.forEach(node => {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', (node.position.x + (node.size || 10) + 5).toString());
            text.setAttribute('y', (node.position.y + 4).toString());
            text.setAttribute('font-size', '11');
            text.setAttribute('font-family', 'system-ui, sans-serif');
            text.setAttribute('fill', '#202124');
            text.setAttribute('pointer-events', 'none');

            const maxLength = 25;
            const displayText = node.title.length > maxLength ?
                node.title.substring(0, maxLength) + '...' : node.title;

            text.textContent = displayText;

            labelsGroup.appendChild(text);
        });
    }

    private highlightNode(nodeId: string): void {
        // Highlight the node and its connections
        const connectedNodes = new Set([nodeId]);

        this.edges.forEach(edge => {
            if (edge.source === nodeId) connectedNodes.add(edge.target);
            if (edge.target === nodeId) connectedNodes.add(edge.source);
        });

        // Dim non-connected elements
        const nodesGroup = this.svg.querySelector('.nodes') as SVGGElement;
        const edgesGroup = this.svg.querySelector('.edges') as SVGGElement;

        if (nodesGroup) {
            Array.from(nodesGroup.children).forEach((element, index) => {
                const node = this.nodes[Math.floor(index / 2)]; // Account for access rings
                if (node && !connectedNodes.has(node.id)) {
                    element.setAttribute('opacity', '0.3');
                }
            });
        }

        if (edgesGroup) {
            Array.from(edgesGroup.children).forEach((element, index) => {
                const edge = this.edges[index];
                if (edge && !connectedNodes.has(edge.source) && !connectedNodes.has(edge.target)) {
                    element.setAttribute('opacity', '0.1');
                }
            });
        }
    }

    private clearHighlight(): void {
        // Reset all opacities
        const nodesGroup = this.svg.querySelector('.nodes') as SVGGElement;
        const edgesGroup = this.svg.querySelector('.edges') as SVGGElement;

        if (nodesGroup) {
            Array.from(nodesGroup.children).forEach(element => {
                element.removeAttribute('opacity');
            });
        }

        if (edgesGroup) {
            Array.from(edgesGroup.children).forEach((element, index) => {
                const edge = this.edges[index];
                if (edge) {
                    element.setAttribute('opacity', (edge.confidence * 0.8 + 0.2).toString());
                }
            });
        }
    }

    private handleZoom(event: WheelEvent): void {
        const delta = event.deltaY > 0 ? 0.9 : 1.1;
        this.scale *= delta;
        this.scale = Math.max(0.1, Math.min(3, this.scale));

        this.updateTransform();
    }

    private handleMouseDown(event: MouseEvent): void {
        if (event.target === this.svg) {
            this.isDragging = true;
            this.svg.style.cursor = 'grabbing';
            this.dragOffset = {
                x: event.clientX - this.translateX,
                y: event.clientY - this.translateY
            };
        }
    }

    private handleMouseMove(event: MouseEvent): void {
        if (this.isDragging) {
            this.translateX = event.clientX - this.dragOffset.x;
            this.translateY = event.clientY - this.dragOffset.y;
            this.updateTransform();
        } else if (this.dragNode) {
            const rect = this.svg.getBoundingClientRect();
            const x = (event.clientX - rect.left) / this.scale - this.translateX / this.scale;
            const y = (event.clientY - rect.top) / this.scale - this.translateY / this.scale;

            this.dragNode.position.x = x;
            this.dragNode.position.y = y;

            this.render();
        }
    }

    private handleMouseUp(event: MouseEvent): void {
        this.isDragging = false;
        this.dragNode = null;
        this.svg.style.cursor = 'grab';
    }

    private startNodeDrag(node: GraphNode, event: MouseEvent): void {
        this.dragNode = node;
        event.preventDefault();
    }

    private updateTransform(): void {
        const nodesGroup = this.svg.querySelector('.nodes') as SVGGElement;
        const edgesGroup = this.svg.querySelector('.edges') as SVGGElement;
        const labelsGroup = this.svg.querySelector('.labels') as SVGGElement;
        const clustersGroup = this.svg.querySelector('.clusters') as SVGGElement;

        const transform = `translate(${this.translateX}, ${this.translateY}) scale(${this.scale})`;

        if (nodesGroup) nodesGroup.setAttribute('transform', transform);
        if (edgesGroup) edgesGroup.setAttribute('transform', transform);
        if (labelsGroup) labelsGroup.setAttribute('transform', transform);
        if (clustersGroup) clustersGroup.setAttribute('transform', transform);
    }

    public zoomIn(): void {
        this.scale *= 1.2;
        this.scale = Math.min(3, this.scale);
        this.updateTransform();
    }

    public zoomOut(): void {
        this.scale *= 0.8;
        this.scale = Math.max(0.1, this.scale);
        this.updateTransform();
    }

    public resetView(): void {
        this.scale = 1;
        this.translateX = 0;
        this.translateY = 0;
        this.updateTransform();
    }

    public fitToView(): void {
        if (this.nodes.length === 0) return;

        const bounds = this.calculateClusterBounds(this.nodes);
        const padding = 50;

        const scaleX = (this.options.width - 2 * padding) / bounds.width;
        const scaleY = (this.options.height - 2 * padding) / bounds.height;
        this.scale = Math.min(scaleX, scaleY, 1);

        this.translateX = (this.options.width - bounds.width * this.scale) / 2 - bounds.minX * this.scale;
        this.translateY = (this.options.height - bounds.height * this.scale) / 2 - bounds.minY * this.scale;

        this.updateTransform();
    }

    public getNodeById(id: string): GraphNode | undefined {
        return this.nodes.find(node => node.id === id);
    }

    public updateNodePosition(id: string, position: { x: number; y: number }): void {
        const node = this.getNodeById(id);
        if (node) {
            node.position = position;
            this.render();
        }
    }

    public destroy(): void {
        this.container.innerHTML = '';
    }
}