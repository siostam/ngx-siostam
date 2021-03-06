import { AfterViewInit, Component, ElementRef, HostListener, Input, OnInit, ViewChild } from '@angular/core';
import * as SvgPanZoom from 'svg-pan-zoom';
import { ObjectType, SelectionReference, SelectorService } from '../selector.service';
import { GraphUpdaterService } from '../graph-updater.service';
import { Subsystem } from '../../models';

/// We want the <svg> to take all the space available.
const SVGElementStyle = 'width:100%;height:100%;position:absolute;top:0;left:0;bottom:0;right:0;';

@Component({
    selector: 'app-map-display',
    templateUrl: './map-display.component.html',
    styleUrls: ['./map-display.component.scss']
})
export class MapDisplayComponent implements OnInit, AfterViewInit {

    constructor(private graphUpdater: GraphUpdaterService, private selector: SelectorService) {}
    @ViewChild('svgContainer', { static: true })
    svgContainer: ElementRef;
    svgElement: SVGSVGElement;

    svgPanZoom: SvgPanZoom.Instance;
    lastSelection: SelectionReference;
    isReady = false;

    /**
     * The parent of the polygon or the text is the <svg:g> with the id. We want it.
     * Move upwards in the hierarchy to find it.
     * @param target The clicked SVG element
     */
    private static searchParentsForSubsystem(target: HTMLElement): SelectionReference {
        if (!target) {
            return null;
        }

        while (target.parentElement) {
            target = target.parentElement;
            const id = target.id;
            if (!id) {
                // Ignore this
            } else if (id.startsWith('system_')) {
                return {
                    type: ObjectType.System,
                    id: id.substr(7),
                };
            } else if (id.startsWith('subsystem_')) {
                return {
                    type: ObjectType.Subsystem,
                    id: id.substr(10),
                };
            }
        }

        return null;
    }

    @HostListener('window:resize', ['$event'])
    onResize(event: any) {
        if (this.svgPanZoom) {
            this.svgPanZoom.resize();
        }
    }

    ngOnInit(): void {
        // Get the data from the server
        this.graphUpdater.svg.subscribe(svg => {
            // Replace the container content with the new SVG
            this.svgContainer.nativeElement.innerHTML = svg;

            // Init svg-pan-zoom. There is a safety to avoid svg-pan-zoom to be loaded before the UI.
            this.update();

            // Reactivate the selection
            this.addSelectedClass(this.lastSelection);
        });

        // Observe the selection
        this.selector.selected.subscribe(selected => {
            // Disable the last selection
            this.removeSelectedClass(this.lastSelection);

            // Activate the new one
            this.addSelectedClass(selected);

            // Store the selection to disable it later
            this.lastSelection = selected;
        });
    }

    public ngAfterViewInit() {
        this.isReady = true;

        // Init svg-pan-zoom. This is in the case the UI is slower than the SVG request
        this.update();
    }

    /**
     * Clicking on a unselected item selects it
     * Clicking on a selected item unselect it
     */
    public onClick(event: any) {
        const possibleSelection = MapDisplayComponent.searchParentsForSubsystem(event.target);
        if (this.selector.isSelected(possibleSelection)) {
            this.selector.unselect();
        } else {
            this.selector.select(possibleSelection);
        }
    }

    private update() {
        if (this.isReady && this.svgContainer) {
            this.svgElement = this.svgContainer.nativeElement.querySelector('svg');

            // The element may not be ready yet. Ignore if this is the case
            if (this.svgElement) {
                /// We want the <svg> to take all the space available.
                this.svgElement.setAttribute('style', SVGElementStyle);
                this.svgPanZoom = SvgPanZoom(this.svgElement, {
                    contain: true,
                    controlIconsEnabled: true,
                });
            }
        }
    }

    /**
     * (De)activate the links around a subsystem
     */
    private setDependenciesClass(selection: SelectionReference, className: string) {
        const lastSubsystem = this.graphUpdater.getFromSelection(selection) as Subsystem;
        if (lastSubsystem && lastSubsystem.dependencies) {
            for (const dep of lastSubsystem.dependencies) {
                const edgeId = `${lastSubsystem.id}_to_${dep.subsystem.id}`;
                const edge = document.getElementById(edgeId);
                if (edge) { edge.setAttribute('class', className); }
            }
        }
    }

    /**
     * Used to apply new selection
     * @param selected
     */
    private addSelectedClass(selected: SelectionReference) {
        if (selected) {
            switch (selected.type) {
                case ObjectType.System:
                    const system = document.getElementById(`system_${selected.id}`);
                    if (system) {
                        system.setAttribute('class', 'cluster selected');
                    }
                    break;
                case ObjectType.Subsystem:
                    const subsystem = document.getElementById(`subsystem_${selected.id}`);
                    if (subsystem) {
                        subsystem.setAttribute('class', 'node selected');
                    }

                    // Handle links
                    this.setDependenciesClass(selected, 'edge selected');
                    break;
            }
        }
    }

    /**
     * Used to disable last selection
     */
    private removeSelectedClass(selected: SelectionReference) {
        if (selected) {
            switch (selected.type) {
                case ObjectType.System:
                    const system = document.getElementById(`system_${this.lastSelection.id}`);
                    if (system) {
                        system.setAttribute('class', 'cluster');
                    }
                    break;
                case ObjectType.Subsystem:
                    const subsystem = document.getElementById(`subsystem_${this.lastSelection.id}`);
                    if (subsystem) {
                        subsystem.setAttribute('class', 'node');
                    }

                    // Handle links
                    this.setDependenciesClass(this.lastSelection, 'edge');
                    break;
            }
        }
    }
}
