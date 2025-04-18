// Helper function to recursively extract modules
function extractModules(modules) {
    const allModules = [];
    for (const module of modules) {
        allModules.push({
            id: module.name || module.identifier, // Use name or identifier as the unique id
            name: module.name,
            size: module.size,
            depth: module.depth,
            providedExports: module.providedExports,
        });
        if (module.children) {
            for (const child of module.children) {
                if (child.modules) {
                    allModules.push(...extractModules(child.modules));
                }
            }
        }
    }
    return allModules;
}

// Helper function to recursively extract chunks
function extractChunks(chunks) {
    const allChunks = [];
    for (const chunk of chunks) {
        allChunks.push({
            id: chunk.name || chunk.identifier, // Use name or identifier as the unique id
            name: chunk.names[0],
            size: chunk.size,
            depth: chunk.depth,
            files: chunk.files,
            providedExports: chunk.providedExports,
        });
        if (chunk.modules) {
            allChunks.push(...extractModules(chunk.modules));
        }
        if (chunk.children) {
            for (const child of chunk.children) {
                if (child.chunks) {
                    allChunks.push(...extractChunks(child.chunks));
                }
            }
        }
    }
    return allChunks;
}

// Parse stats.json for module-level visualization
function parseStatsModuleLevel(stats) {
    const nodes = [
        ...extractModules(stats.modules || []),
        ...extractModules(stats.children?.flatMap(child => child.modules || []) || [])
    ];
    const nodeMap = new Map();
    for (const node of nodes) {
        nodeMap.set(node.name, node);
    }

    const edges = [];
    const uniqueEdgesMap = new Map();
    function pushEdge(edges, source, target) {
        edges.push({ source, target });
        if (!nodeMap.has(source)) {
            const inferredNode = { id: source, name: source, type: 'inferred' };
            nodes.push(inferredNode);
            nodeMap.set(source, inferredNode);
        }
        if (!nodeMap.has(target)) {
            const inferredNode = { id: source, name: target, type: 'inferred' };
            nodes.push(inferredNode);
            nodeMap.set(target, inferredNode);
        }
    }

    const addEdgesFromReasons = (modules) => {
        for (const module of modules) {
            if (module.reasons) {
                for (const reason of module.reasons) {
                    if (reason.moduleId !== undefined && reason.moduleId !== null) {
                        const edgeKey = `${reason.moduleName}-${module.name || module.identifier}`;
                        if (!uniqueEdgesMap.has(edgeKey)) {
                            uniqueEdgesMap.set(edgeKey, true);
                            pushEdge(edges, reason.moduleName || reason.moduleId, module.name || module.identifier);
                        }
                    }
                }
            }
            if (module.issuerName !== undefined && module.issuerName !== null) {
                const edgeKey = `${module.issuerName}-${module.name || module.identifier}`;
                if (!uniqueEdgesMap.has(edgeKey)) {
                    uniqueEdgesMap.set(edgeKey, true);
                    pushEdge(edges, module.issuerName || module.issuerId, module.name || module.identifier);
                }
            }
        }
    };

    // Add edges for top-level modules
    addEdgesFromReasons(stats.modules || []);

    // Add edges for nested modules in chunks
    if (stats.chunks) {
        for (const chunk of stats.chunks) {
            if (chunk.modules) {
                addEdgesFromReasons(chunk.modules);
            }
        }
    }

    // Add edges for nested modules in children
    if (stats.children) {
        for (const child of stats.children) {
            addEdgesFromReasons(child.modules || []);
        }
    }

    return { nodes, edges };
}

// Parse stats.json for chunk-level visualization
function parseStatsChunkLevel(stats) {
    const nodes = [
        ...extractChunks(stats.chunks || []),
        ...extractChunks(stats.children?.flatMap(child => child.chunks || []) || [])
    ];
    const nodeMap = new Map();
    for (const node of nodes) {
        nodeMap.set(node.name, node);
    }

    const edges = [];
    const uniqueEdgesMap = new Map();
    function pushEdge(edges, source, target) {
        edges.push({ source, target });
        if (!nodeMap.has(source)) {
            const inferredNode = { id: source, name: source, type: 'inferred' };
            nodes.push(inferredNode);
            nodeMap.set(source, inferredNode);
        }
        if (!nodeMap.has(target)) {
            const inferredNode = { id: source, name: target, type: 'inferred' };
            nodes.push(inferredNode);
            nodeMap.set(target, inferredNode);
        }
    }

    if (stats.chunks) {
        for (const chunk of stats.chunks) {
            // Add edges for chunk dependencies
            if (chunk.parents) {
                for (const parentId of chunk.parents) {
                    const edgeKey = `${parentId.name || parentId.identifier}-${chunk.name || chunk.identifier}`;
                    if (!uniqueEdgesMap.has(edgeKey)) {
                        uniqueEdgesMap.set(edgeKey, true);
                        pushEdge(edges, parentId.name || parentId.identifier, chunk.name || chunk.identifier);
                    }
                }
            }
            if (chunk.children) {
                for (const childId of chunk.children) {
                    const edgeKey = `${chunk.name || chunk.identifier}-${childId.name || childId.identifier}`;
                    if (!uniqueEdgesMap.has(edgeKey)) {
                        uniqueEdgesMap.set(edgeKey, true);
                        pushEdge(edges, chunk.name || chunk.identifier, childId.name || childId.identifier);
                    }
                }
            }

            // Add edges for chunk-to-module relationships
            if (chunk.modules) {
                for (const module of chunk.modules) {
                    const edgeKey = `${chunk.name || chunk.identifier}-${module.name || module.identifier}`;
                    if (!uniqueEdgesMap.has(edgeKey)) {
                        uniqueEdgesMap.set(edgeKey, true);
                        pushEdge(edges, chunk.name || chunk.identifier, module.name || module.identifier);
                    }
                }
            }
        }
    }

    if (stats.children) {
        for (const child of stats.children) {
            if (child.chunks) {
                for (const chunk of child.chunks) {
                    // Add edges for child chunk dependencies
                    if (chunk.parents) {
                        for (const parentId of chunk.parents) {
                            pushEdge(edges, parentId.name || parentId.identifier, chunk.name || chunk.identifier);
                        }
                    }
                    if (chunk.children) {
                        for (const childId of chunk.children) {
                            pushEdge(edges, chunk.name || chunk.identifier, childId.name || childId.identifier);
                        }
                    }

                    // Add edges for child chunk-to-module relationships
                    if (chunk.modules) {
                        for (const module of chunk.modules) {
                            pushEdge(edges, chunk.name || chunk.identifier, module.name || module.identifier);
                        }
                    }
                }
            }
        }
    }

    return { nodes, edges };
}

function renderGraph({ nodes, edges }) {
    const container = d3.select('#graph-container');
    container.selectAll('svg').remove(); // Clear existing SVG content

    // Display file name
    const fileNameDisplay = document.getElementById('file-name-display');
    if (!fileNameDisplay) {
        const displayElement = document.createElement('div');
        displayElement.id = 'file-name-display';
        displayElement.textContent = 'stats.json';
        container.node().appendChild(displayElement);
    }

    const width = container.node().clientWidth;
    const height = container.node().clientHeight;

    const svg = container.append('svg')
        .attr('width', width)
        .attr('height', height);

    const zoomGroup = svg.append('g'); // Group for zooming

    const defs = zoomGroup.append('defs');

    // Define gradient for links
    const gradient = defs.append('linearGradient')
        .attr('id', 'link-gradient')
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '100%')
        .attr('y2', '0%');
    gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', '#4caf50');
    gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', '#2196f3');

    defs.append('marker')
        .attr('id', 'arrowhead')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 10)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', '#4caf50');

    const tooltip = d3.select('body')
        .append('div')
        .attr('class', 'tooltip')
        .style('position', 'absolute')
        .style('border', '1px solid #ccc')
        .style('padding', '10px')
        .style('border-radius', '8px')
        .style('box-shadow', '0 4px 8px rgba(0, 0, 0, 0.1)')
        .style('display', 'none')
        .style('font-size', '14px');

    const simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(edges)
            .id(d => d.id)
            .distance(100))
        .force('charge', d3.forceManyBody().strength(-200))
        .force('center', d3.forceCenter(width / 2, height / 2));

    const link = zoomGroup.append('g') // Append to zoom group
        .attr('class', 'links')
        .selectAll('line')
        .data(edges)
        .enter()
        .append('line')
        .attr('stroke', 'url(#link-gradient)')
        .attr('stroke-width', 3)
        .attr('marker-end', 'url(#arrowhead)');

    const node = zoomGroup.append('g') // Append to zoom group
        .attr('class', 'nodes')
        .selectAll('circle')
        .data(nodes)
        .enter()
        .append('circle')
        .attr('r', 15)
        .attr('fill', d => d.files ? 'url(#node-gradient)' : '#2196f3') // Gradient for chunks, solid for modules
        .attr('stroke', '#333')
        .attr('stroke-width', 2)
        .classed('root', d => d.depth === 0) // Add 'root' class for nodes with depth === 0
        .classed('inferred', d => d.type === 'inferred') // Add 'inferred' class for inferred nodes
        .style('filter', 'drop-shadow(0px 4px 6px rgba(0, 0, 0, 0.2))')
        .on('mouseover', (event, d) => {
            tooltip.style('display', 'flex')
                .html([
                    `<p><strong>Name:</strong> ${d.type === 'inferred' ? '(inferred) ' : ''}${d.name ?? 'N/A'}</p>`,
                    `<p><strong>Size:</strong> ${d.size ?? 'N/A'} bytes</p>`,
                    typeof d.depth !== 'undefined' && `<p><strong>Depth:</strong> ${d.depth ?? 'N/A'}</p>`,
                    Array.isArray(d.providedExports) && d.providedExports.length > 0 && `<p><strong>Provided exports:</strong> ${d.providedExports.join(', ') ?? 'N/A'}</p>`,
                    Array.isArray(d.files) && d.files.length > 0 && `<p><strong>Files:</strong> ${d.files.join(', ') ?? 'N/A'}</p>`,
                ].filter(Boolean).join(''));
        })
        .on('mousemove', (event) => {
            tooltip.style('left', `${event.pageX + 10}px`)
                .style('top', `${event.pageY + 10}px`);
        })
        .on('mouseout', () => {
            tooltip.style('display', 'none');
        })
        .call(d3.drag()
            .on('start', dragStarted)
            .on('drag', dragged)
            .on('end', dragEnded));

    function truncateLabel(name, maxLength = 30) {
        if (!name) return '';
        if (name.length <= maxLength) return name;
        const lastSlashIndex = name.lastIndexOf('/');
        const fileName = name.substring(lastSlashIndex + 1) || '';
        const prefixLength = Math.max(0, maxLength - fileName.length - 3); // 3 for "..."
        const prefix = name.substring(0, prefixLength);
        return `${prefix}.../${fileName}`;
    }

    const label = zoomGroup.append('g') // Append to zoom group
        .attr('class', 'labels')
        .selectAll('text')
        .data(nodes)
        .enter()
        .append('text')
        .text(d => truncateLabel(d.name))
        .attr('font-size', 14)
        .attr('dx', 20)
        .attr('dy', 5)
        .attr('fill', '#333');

    // Update simulation tick to adjust link positions
    simulation.on('tick', () => {
        link
            .attr('x1', d => {
                const dx = d.target.x - d.source.x;
                const dy = d.target.y - d.source.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const offsetX = (dx / distance) * 15; // 15 is the circle radius
                return d.source.x + offsetX;
            })
            .attr('y1', d => {
                const dx = d.target.x - d.source.x;
                const dy = d.target.y - d.source.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const offsetY = (dy / distance) * 15; // 15 is the circle radius
                return d.source.y + offsetY;
            })
            .attr('x2', d => {
                const dx = d.source.x - d.target.x;
                const dy = d.source.y - d.target.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const offsetX = (dx / distance) * 15; // 15 is the circle radius
                return d.target.x + offsetX;
            })
            .attr('y2', d => {
                const dx = d.source.x - d.target.x;
                const dy = d.source.y - d.target.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const offsetY = (dy / distance) * 15; // 15 is the circle radius
                return d.target.y + offsetY;
            });

        node
            .attr('cx', d => d.x)
            .attr('cy', d => d.y);

        label
            .attr('x', d => d.x)
            .attr('y', d => d.y);
    });

    // Add zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([0.2, 5]) // Set zoom range
        .on('zoom', (event) => {
            zoomGroup.attr('transform', event.transform);
        });

    svg.call(zoom);

    function dragStarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragEnded(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }
}

let cachedStats = null; // Local variable to store stats.json data

// Handle view level change
document.getElementById('view-level').addEventListener('change', event => {
    const viewLevel = event.target.value;
    if (cachedStats) {
        let parsedData;
        if (viewLevel === 'module') {
            parsedData = parseStatsModuleLevel(cachedStats);
        } else if (viewLevel === 'chunk') {
            parsedData = parseStatsChunkLevel(cachedStats);
        }
        renderGraph(parsedData);
    }
});

// Update default load to respect view level
fetch('stats.json')
    .then(response => response.json())
    .then(data => {
        cachedStats = data; // Cache the stats.json data
        const viewLevel = document.getElementById('view-level').value;
        let parsedData;
        if (viewLevel === 'module') {
            parsedData = parseStatsModuleLevel(data);
        } else if (viewLevel === 'chunk') {
            parsedData = parseStatsChunkLevel(data);
        }
        renderGraph(parsedData);
    });

// Handle file uploads
document.getElementById('file-input').addEventListener('change', event => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = e => {
            const data = JSON.parse(e.target.result);
            cachedStats = data; // Cache the uploaded stats.json data
            const viewLevel = document.getElementById('view-level').value;
            let parsedData;
            if (viewLevel === 'module') {
                parsedData = parseStatsModuleLevel(data);
            } else if (viewLevel === 'chunk') {
                parsedData = parseStatsChunkLevel(data);
            }
            renderGraph(parsedData);
        };
        reader.readAsText(file);
    }
});

// Load sample button
document.getElementById('load-sample').addEventListener('click', () => {
    fetch('stats.json')
        .then(response => response.json())
        .then(data => {
            cachedStats = data; // Cache the sample stats.json data
            const viewLevel = document.getElementById('view-level').value;
            let parsedData;
            if (viewLevel === 'module') {
                parsedData = parseStatsModuleLevel(data);
            } else if (viewLevel === 'chunk') {
                parsedData = parseStatsChunkLevel(data);
            }
            renderGraph(parsedData);
        });
});

document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault();
        const searchBox = document.getElementById('search-box');
        searchBox.style.display = 'block';
        searchBox.focus();
    }
});

document.getElementById('search-box').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        const query = event.target.value.toLowerCase();
        const svg = d3.select('svg');
        const nodes = svg.selectAll('.nodes circle');
        const links = svg.selectAll('.links line');
        const labels = svg.selectAll('.labels text');

        if (query.trim() === '') {
            // Reset all nodes and edges
            nodes.style('opacity', 1);
            links.style('opacity', 1);
            labels.style('opacity', 1);
        } else {
            // Perform fuzzy search
            nodes.style('opacity', d => (d.name.toLowerCase().includes(query) ? 1 : 0.3));
            links.style('opacity', d => (
                d.source.name.toLowerCase().includes(query) || d.target.name.toLowerCase().includes(query) ? 1 : 0.3
            ));
            labels.style('opacity', d => (d.name.toLowerCase().includes(query) ? 1 : 0.3));
        }
    }
});
