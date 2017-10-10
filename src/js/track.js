
(function ($) {

    const colorMap = { red: '#D63E2A', orange: '#F59630', green: '#72B026', blue: '#38AADD', purple: '#D252B9',
        darkred: '#A23336', darkblue: '#0067A3', darkgreen: '#728224', darkpurple: '#5B396B', cadetblue: '#436978',
        lightred: '#FF8E7F', beige: '#FFCB92', lightgreen: '#BBF970', lightblue: '#8ADAFF', pink: '#FF91EA',
        white: '#FBFBFB', lightgray: '#A3A3A3', gray: '#575757', black: '#303030', };
    const colors = ['blue', 'green', 'orange', 'purple', 'red', 'darkblue', 'darkpurple', 'lightblue', 'lightgreen', 'beige', 'pink', 'lightred'];

    $.Track = {
        currentColor: 0,
        markersLength: 0,

        bindTo: function (map) {
            this.map = map;
        },

        getCurrentColor: function () {
            return this.currentColor;
        },

        nextColor: function () {
            this.currentColor = (this.currentColor + 1) % colors.length;
            return this.currentColor;
        },

        lengthOfMarkers: function () {
            return this.markersLength;
        },

        hasMarkers: function (size = 1) {
            return this.markersLength >= size;
        },

        hasRoutes: function (size = 1) {
            return (this.markersLength - 1) >= size;
        },

        isImport: function () {
            return this.hasRoutes() && this.getFirstMarker().getRouteModeFromHere() == 'import';
        },

        getBounds: function () {
            const bounds = L.latLngBounds(this.getFirstMarker(0).getLatLng(), this.getLastMarker().getLatLng());
            this.eachRoute(function (i, route) {
                bounds.extend(route.getBounds());
            });

            return bounds;
        },

        getFirstMarker: function () {
            return this.firstMarker;
        },

        getLastMarker: function () {
            return this.lastMarker;
        },

        isLoop: function () {
            return this.firstMarker && this.lastMarker && this.firstMarker.getLatLng().distanceTo(this.lastMarker.getLatLng()) < 10;
        },

        clear: function () {
            this.eachMarker(function (i, marker) { marker.remove(false); });
            $.State.triggerMarkersChanged();
        },

        eachMarker: function (callback) {
            var current = this.firstMarker;
            var i = 0;
            while (current) {
                const next = current._nextMarker;
                callback.call(current, i, current);

                current = next;
                i++;
            }
        },

        eachRoute: function (callback) {
            var next = this.firstMarker;
            var i = 0;
            while (next) {
                const route = next.getRouteFromHere();
                if (route) {
                    callback.call(route, i, route);
                    i++;
                }

                next = next._nextMarker;
            }
        },

        addMarker: function (marker, computeRoute = true) {
            var promise;

            if (this.firstMarker === undefined)
                this.firstMarker = marker;

            if (this.lastMarker !== undefined) {
                if (computeRoute)
                    promise = this.lastMarker.computeRouteTo(marker, $.State.getMode());
            }

            this.lastMarker = marker;
            this.markersLength++;
            marker.addTo(this.map);

            if (promise)
                return promise;
            else
                return $.Deferred(function () {
                    this.resolve();
                });
        },

        moveMarker: function (marker) {
            const _this = this;

            return $.Deferred(function () {
                const deferred = this;  // jscs:ignore safeContextKeyword
                const promises = [];

                const mode = $.State.getMode() || marker.getRouteModeFromHere();

                if (marker.hasRouteFromHere()) {
                    // Re-compute route starting at this marker
                    const idx = promises.length;

                    promises.push(
                        marker.recomputeRouteFromHere($.State.getMode()).progress(deferred.notify)
                    );
                }

                if (marker.hasRouteToHere()) {
                    // Re-compute route ending at this marker
                    const idx = promises.length;

                    promises.push(
                        marker.recomputeRouteToHere($.State.getMode()).progress(deferred.notify)
                    );
                }

                $.when.apply($, promises).done(deferred.resolve).fail(deferred.fail);
            });
        },

        insertMarker: function (marker, route) {
            const _this = this;

            return $.Deferred(function () {
                const deferred = this;  // jscs:ignore safeContextKeyword
                const promises = [];

                const mode = $.State.getMode() || marker.getRouteModeFromHere();

                promises.push(
                    route.getStartMarker().computeRouteTo(marker, $.State.getMode()).progress(deferred.notify)
                );
                promises.push(
                    marker.computeRouteTo(route.getEndMarker(), $.State.getMode()).progress(deferred.notify)
                );

                _this.markersLength++;
                marker.addTo(_this.map);

                $.when.apply($, promises).done(deferred.resolve).fail(deferred.fail);
            });
        },

        _initStats: function () {
            return {
                distance: 0,
                altMin: Number.MAX_VALUE,
                altMax: Number.MIN_VALUE,
                denivPos: 0,
                denivNeg: 0,
            };
        },

        computeStats: function () {
            const _this = this;

            var steps = [];
            var elevations = [];
            var total = this._initStats();
            var local = this._initStats();

            $.Track.eachMarker(function (i, marker) {
                if (marker.getType() == 'step') {
                    steps.push(total.distance);

                    var current = marker;
                    while (current && current.hasRouteToHere()) {
                        current.getRouteToHere().setPopupContentWith(current._previousMarker.getColorCode(), local);
                        current = current._previousMarker;
                        if (current.getType() == 'step')
                            break;
                    }

                    local = _this._initStats();
                }

                const route = marker.getRouteFromHere();
                const e = route ? route.getElevations() : [];
                if (e.length > 0) {
                    // Compute stats on global track

                    for (var j = 0; j < e.length; j++) {
                        e[j].dist += total.distance;
                        e[j].route = route;
                    }

                    elevations = elevations.concat(e);
                    total.distance += route.getDistance();

                    total.altMin = Math.min(total.altMin, route.getAltMin());
                    total.altMax = Math.max(total.altMax, route.getAltMax());

                    total.denivNeg += route.getDenivNeg();
                    total.denivPos += route.getDenivPos();

                    // Compute stats on current step
                    local.distance += route.getDistance();

                    local.altMin = Math.min(local.altMin, route.getAltMin());
                    local.altMax = Math.max(local.altMax, route.getAltMax());

                    local.denivNeg += route.getDenivNeg();
                    local.denivPos += route.getDenivPos();
                }
            });

            if (local.distance > 0) {
                var current = $.Track.getLastMarker();
                while (current && current.hasRouteToHere()) {
                    current.getRouteToHere().setPopupContentWith(current._previousMarker.getColorCode(), local);
                    current = current._previousMarker;
                    if (current.getType() == 'step')
                        break;
                }
            }

            return {
                size: elevations.length,
                elevations,
                total,
                steps,
            };
        },

        exportGpx: function (filename) {
            let isFileSaverSupported = false;
            try {
                isFileSaverSupported = !!(new Blob());
            } catch (e) {}
            if (!isFileSaverSupported) { /* can't check this until Blob polyfill loads above */
                return false;
            }

            let xml = '<?xml version="1.0"?>\n';
            xml += '<gpx creator="map2gpx.fr" version="1.0" xmlns="http://www.topografix.com/GPX/1/1"';
            xml += ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"';
            xml += ' xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">\n';
            xml += '    <trk>\n';
            xml += '        <name>' + filename + '</name>\n';
            xml += '        <trkseg>\n';

            this.eachMarker(function (i, marker) {
                if (marker.hasRouteFromHere()) {
                    if (marker.getType() == 'step') {
                        xml += '        </trkseg>\n';
                        xml += '    </trk>\n';
                        xml += '    <trk>\n';
                        xml += '        <name>' + filename + '-' + i + '</name>\n';
                        xml += '        <trkseg>\n';
                    }

                    $.each(marker.getRouteFromHere().getLatLngs(), function (j, coords) {
                        xml += '            <trkpt lat="' + coords.lat + '" lon="' + coords.lng + '">';
                        if ($.Cache.hasAltitude(coords))
                            xml += '<ele>' + $.Cache.getAltitude(coords) + '</ele>';
                        xml += '</trkpt>\n';
                    });
                }
            });

            xml += '        </trkseg>\n';
            xml += '    </trk>\n';
            xml += '</gpx>\n';

            var blob = new Blob([xml], { type: 'application/gpx+xml;charset=utf-8' });
            saveAs(blob, filename + '.gpx');
            return true;
        },

        exportKml: function (filename) {
            let isFileSaverSupported = false;
            try {
                isFileSaverSupported = !!(new Blob());
            } catch (e) {}
            if (!isFileSaverSupported) { /* can't check this until Blob polyfill loads above */
                return false;
            }

            let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
            xml += '<kml xmlns="http://www.opengis.net/kml/2.2"';
            xml += ' xmlns:gx="http://www.google.com/kml/ext/2.2"';
            xml += ' xmlns:kml="http://www.opengis.net/kml/2.2"';
            xml += ' xmlns:atom="http://www.w3.org/2005/Atom">\n';
            xml += '    <Document>\n';
            xml += '        <name>' + filename + '.kml</name>\n';
            xml += '        <Placemark>\n';
            xml += '            <name>' + filename + '</name>\n';
            xml += '            <LineString>\n';
            xml += '                <tessellate>1</tessellate>\n';
            xml += '                <coordinates>\n';
            xml += '                    ';

            this.eachMarker(function (i, marker) {
                if (marker.hasRouteFromHere()) {
                    if (marker.getType() == 'step') {
                        xml += '\n                </coordinates>\n';
                        xml += '            </LineString>\n';
                        xml += '        </Placemark>\n';
                        xml += '        <Placemark>\n';
                        xml += '            <name>' + filename + '-' + i + '</name>\n';
                        xml += '            <LineString>\n';
                        xml += '                <tessellate>1</tessellate>\n';
                        xml += '                <coordinates>\n';
                        xml += '                    ';
                    }

                    $.each(marker.getRouteFromHere().getLatLngs(), function (j, coords) {
                        xml += coords.lng + ',' + coords.lat + ',0 ';
                    });
                }
            });

            xml += '\n                </coordinates>\n';
            xml += '            </LineString>\n';
            xml += '        </Placemark>\n';
            xml += '    </Document>\n';
            xml += '</kml>\n';

            var blob = new Blob([xml], { type: 'text/plain;charset=utf-8' });
            saveAs(blob, filename + '.kml');
            return true;
        },

        _removeMarker: function (marker) {
            if (this.firstMarker === marker)
                this.firstMarker = marker._nextMarker;   // Potentially undefined
            if (this.lastMarker === marker)
                this.lastMarker = marker._previousMarker;    // Potentially undefined

            this.markersLength--;
        },
    };

    L.Marker.Routed = L.Marker.extend({
        options: {
            type: 'waypoint',
            color: 0,
        },

        initialize: function (latlng, options) {
            L.Marker.prototype.initialize.call(this, latlng, options);
            L.setOptions(this, options);

            this.setType(this.options.type);
        },

        getColorCode: function () {
            return colors[this.options.color];
        },
        getColorRgb: function () {
            return colorMap[colors[this.options.color]];
        },
        getColorIndex: function () {
            return this.options.color;
        },
        setColorIndex: function (i) {
            this.options.color = i;
            this.setType(this.options.type);

            if (this.routeFrom) {
                this.routeFrom.setStyle({ color: this.getColorRgb() });
            }
        },
        getType: function () {
            return this.options.type;
        },
        setType: function (type) {
            this.options.type = type;
            if (type == 'waypoint') {
                this.setIcon(L.AwesomeMarkers.icon({
                    icon: 'circle',
                    markerColor: this.getColorCode(),
                    prefix: 'fa',
                }));
            } else {
                this.setIcon(L.AwesomeMarkers.icon({
                    icon: 'asterisk',
                    markerColor: this.getColorCode(),
                    prefix: 'fa',
                }));
            }
        },

        promoteToStep: function () {
            const newColor = $.Track.nextColor();

            var _this = this;
            while (_this && _this.options.type != 'step') {
                _this.setColorIndex(newColor);
                _this = _this._nextMarker;
            }

            this.setType('step');
            $.State.triggerMarkersChanged();
        },

        demoteToWaypoint: function () {
            this.setType('waypoint');

            if (this.hasRouteToHere()) {
                const newColor = this._previousMarker.getColorIndex();

                var _this = this;
                while (_this && _this.options.type != 'step') {
                    _this.setColorIndex(newColor);
                    _this = _this._nextMarker;
                }
            }

            $.State.triggerMarkersChanged();
        },

        hasRouteToHere: function () {
            return (this._previousMarker && this._previousMarker.hasRouteFromHere());
        },
        getRouteToHere: function () {
            return this._previousMarker.routeFrom;
        },
        hasRouteFromHere: function () {
            return !!this.routeFrom;
        },
        getRouteFromHere: function () {
            return this.routeFrom;
        },
        getRouteModeFromHere: function () {
            return this._mode;
        },

        deleteRouteFromHere: function () {
            if (this._nextMarker)
                this._nextMarker._previousMarker = undefined;
            if (this.routeFrom)
                this.routeFrom.remove();
            this.attachRouteFrom(undefined, null, undefined);
        },

        computeRouteTo: function (to, mode) {
            const _this = this;

            return $.Deferred(function () {
                const deferred = this;  // jscs:ignore safeContextKeyword

                if (_this.routeFrom) {
                    _this.routeFrom.setStyle({ opacity: 0.5 });
                }

                $(_this).clearCompute();
                $(_this).startCompute(function (next) {
                    mode = mode || _this._mode || 'auto';

                    $.Route.find(_this, to, 0, mode)
                        .progress(deferred.notify)
                        .done(function () {
                            _this.deleteRouteFromHere();
                            _this.attachRouteFrom(to, this.route, mode);
                            deferred.resolve();
                        })
                        .fail(deferred.reject)
                        .always(() => $(_this).endCompute(next));
                });
            });
        },

        recomputeRouteFromHere: function (mode) {
            return this.computeRouteTo(this._nextMarker, mode);
        },

        recomputeRouteToHere: function (mode) {
            return this._previousMarker.computeRouteTo(this, mode);
        },

        attachRouteFrom: function (to, route, mode) {
            this._nextMarker = to;
            if (to)
                to._previousMarker = this;
            this.routeFrom = route;
            this._mode = mode;
        },

        _bindEvents: function () {
            const _this = this;

            this.bindPopup('<button class="marker-promote-button"><i class="fa fa-asterisk" aria-hidden="true"></i> Marquer comme étape</button> ' +
                '<button class="marker-delete-button"><i class="fa fa-trash" aria-hidden="true"></i> Supprimer ce marqueur</button>');

            this.on('popupopen', function () {

                $('.marker-delete-button:visible').click(function () {
                    if ($.State.getComputing()) // FIXME: Dirty hack to enable reset on markers (also, fixes flickering of data pane when importing)
                        return;

                    $.State.setComputing(true);
                    _this.remove().progress($.State.updateComputing).done(function () {
                        $.State.setComputing(false);
                    }).fail(function () {
                        $.State.setComputing(false);
                    });
                });

                $('.marker-promote-button:visible').click(function () {
                    _this.closePopup();
                    _this.setPopupContent('<button class="marker-delete-button"><i class="fa fa-trash" aria-hidden="true"></i> Supprimer ce marqueur</button>');
                    _this.promoteToStep();
                    $.State.setComputing(false);    // Force replot
                });
            });

            this.on('moveend', function (event) {
                // Update routes when moving this marker
                $.State.setComputing(true);
                _this.setOpacity(0.5);

                $.Track.moveMarker(_this)
                    .progress($.State.updateComputing)
                    .done(function () {
                        $.State.setComputing(false);
                        event.target.setOpacity(1);
                    }).fail(function () {
                        $.State.setComputing(false);
                    });
            });
        },

        add: function (computeRoute = true) {
            this._bindEvents();
            return $.Track.addMarker(this, computeRoute);
        },

        insert: function (route) {
            this._bindEvents();
            return $.Track.insertMarker(this, route);
        },

        remove: function (recompute = true) {
            var promise;

            if (this.options.type == 'step' && recompute) {
                // Change colors of next markers until next step
                this.demoteToWaypoint();
            }

            const previous = this._previousMarker;
            const next = this._nextMarker;

            $.Track._removeMarker(this);

            if (this.routeFrom) {
                this.deleteRouteFromHere();
            }

            if (previous) {
                // Has a route to here

                previous.deleteRouteFromHere();

                if (next && recompute) {
                    // Re-connect markers
                    const mode = $.State.getMode() || this._mode || 'auto';

                    promise = previous.computeRouteTo(next, mode);

                }
            }

            L.Marker.prototype.remove.call(this);

            if (promise)
                return promise;
            else
                return $.Deferred(function () {
                    this.resolve();
                });
        },
    });

    L.Marker.routed = function (latlng, options) {
        return new L.Marker.Routed(latlng, options);
    };

})(jQuery);
