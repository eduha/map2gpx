/* global $, Map2gpx */
const L = require('leaflet');

module.exports = {
  addLayers(map, visibleBaseLayers, visibleOverlays, hiddenBaseLayers, hiddenOverlays, controlType) {
    const baseLayers = {};
    const overlays = {};

    Object.keys(visibleBaseLayers).forEach((key) => {
      visibleBaseLayers[key].addTo(map);
      baseLayers[key] = visibleBaseLayers[key];
    });
    Object.keys(visibleOverlays).forEach((key) => {
      visibleOverlays[key].addTo(map);
      overlays[key] = visibleOverlays[key];
    });

    Object.keys(hiddenBaseLayers).forEach((key) => {
      if (controlType === 'geoportail') hiddenBaseLayers[key].addTo(map);
      baseLayers[key] = hiddenBaseLayers[key];
    });
    Object.keys(hiddenOverlays).forEach((key) => {
      if (controlType === 'geoportail') hiddenOverlays[key].addTo(map);
      overlays[key] = hiddenOverlays[key];
    });

    let control;
    switch (controlType) {
      case 'native':
        control = L.control.layers(baseLayers, overlays, { collapsed: false }).addTo(map);
        break;

      case 'geoportail':
        control = L.geoportalControl.LayerSwitcher({
          collapsed: false,
        });
        map.addControl(control);
        Object.keys(hiddenBaseLayers).forEach((key) => {
          control.setVisibility(hiddenBaseLayers[key], false);
        });
        Object.keys(hiddenOverlays).forEach((key) => {
          control.setVisibility(hiddenOverlays[key], false);
        });
        $('.GPlayerRemove').remove();
        break;

      default:
        throw new Error('Unsupported control type');
    }

    return control;
  },

  addZoom(map, options = {}) {
    return L.control.zoom(options).addTo(map);
  },

  addScale(map) {
    return L.control.scale({ imperial: false, position: 'bottomcenter' }).addTo(map);
  },

  addGeocoder(map, options = {}) {
    const opts = $.extend({}, { position: 'topleft', expand: 'click', defaultMarkGeocode: false }, options);

    return L.Control.geocoder(opts)
      .on('markgeocode', (e) => {
        map.setView(e.geocode.center, 15);
      })
      .addTo(map);
  },

  addTrackDrawer(map, fetcher, geocoder) {
    const drawRoute = L.TrackDrawer.track({
      fetcher,
      debug: false,
    }).addTo(map);
    map.initView(drawRoute, geocoder);

    return drawRoute;
  },

  addImportExportButtons(map, track, options) {
    const opts = $.extend({}, { optionsImport: { id: 'btn-import' }, optionsExport: { id: 'btn-export' } }, options);
    const importBtn = new Map2gpx.ImportButton(track, opts.optionsImport);
    const exportBtn = new Map2gpx.ExportButton(track, opts.optionsExport);
    return L.easyBar([importBtn, exportBtn]).addTo(map);
  },

  addTrackDrawerToolbar(map, track, options) {
    const opts = $.extend({}, { direction: 'horizontal', position: 'topcenter' }, options);
    return L.TrackDrawer.control(track, opts).addTo(map);
  },

  addTrackDrawerTracebar(map, track, options) {
    return L.TrackDrawer.traceModeBar(
      track,
      [
        {
          id: 'auto',
          icon: 'fa-map-o',
          name: options.labelAuto,
          router: options.routerAuto,
        },
        {
          id: 'line',
          icon: 'fa-compass',
          name: options.labelLine,
          router: L.Routing.straightLine(),
        },
      ],
      {
        direction: 'horizontal',
        position: 'topcenter',
        mode: 'auto',
      },
    ).addTo(map);
  },

  addMinimap(map, layer) {
    return new L.Control.MiniMap(layer, {
      position: 'bottomleft',
      zoomLevelOffset: -4,
    }).addTo(map);
  },

  addInfoToolbar(map, options) {
    const infoBtn = L.easyButton({
      position: 'bottomright',
      states: [
        {
          icon: 'fa-info-circle',
          onClick: () => {
            $('#about').dialog({
              autoOpen: true,
              modal: true,
              minWidth: 600,
              buttons: {
                Ok() {
                  $(this).dialog('close');
                },
              },
            });
          },
          title: options.labelInfo,
        },
      ],
    });
    const helpBtn = L.easyButton({
      position: 'bottomright',
      states: [
        {
          icon: 'fa-question-circle',
          onClick: () => {
            $.Shepherd.get(0).start(true);
          },
          title: options.labelHelp,
        },
      ],
    });

    return L.easyBar([infoBtn, helpBtn], { position: 'bottomright' }).addTo(map);
  },

  addChart(map, track, options) {
    const progressbar = $('#data-computing').progress({
      labelComputing: options.labelComputing,
    });
    track.on('TrackDrawer:start', () => {
      progressbar.progress('start');
      $('#data-computing').slideDown();
    });
    track.on('TrackStats:fetching', (e) => {
      progressbar.progress('update', {
        start: true,
        total: e.size,
        step: `🤖 ${e.size} ${options.labelFetching}`,
      });
    });
    track.on('TrackStats:fetched', (e) => {
      progressbar.progress('update', {
        count: e.size,
        step: `⭐️ ${e.size} ${options.labelFetched}`,
      });
    });
    track.on('TrackDrawer:statsfailed', (e) => {
      progressbar.progress('failed', e);
    });
    track.on('TrackDrawer:statsdone', () => {
      progressbar.progress('stop');

      $('#data')
        .data('map2gpx-chart')
        .replot(track.getStatsTotal(), track.getStatsSteps().map(x => x.startingDistance));

      track.getNodes().forEach((n) => {
        n.markers.forEach((node) => {
          if (node.getPopup() === undefined) {
            node.bindPopup('<>');
          }
          node.setPopupContent(
            `<ul class="legend ${node.options.colorName}">`
              + `<li>${options.labelAltitude}: ${Math.round(node._stats.z)}m</li>`
              + `<li>${options.labelDistanceFromStart}: ${Math.round(node._stats.distance * 100) / 100}km</li>`
              + `<li>${options.labelDistanceFromLastStopover}: ${Math.round(node._stats.startingDistance * 100)
                / 100}km</li></ul>`,
          );
        });
      });

      track.getSteps().forEach((g) => {
        const c = g.container;
        if (c.getPopup() === undefined) {
          c.bindPopup('<>');
        }
        const colorName = L.TrackDrawer.colors.rgbToName(g.edges[0].options.color);
        c.setPopupContent(
          `<ul class="legend ${colorName}">`
            + `<li>${options.labelAltitudeMax}: ${Math.round(c._stats.getAltMax())}m</li>`
            + `<li>${options.labelHeightDiffUp}: ${Math.round(c._stats.getHeightDiffUp())}m</li>`
            + `<li>${options.labelAltitudeMin}: ${Math.round(c._stats.getAltMin())}m</li>`
            + `<li>${options.labelHeightDiffDown}: ${Math.round(c._stats.getHeightDiffDown())}m</li>`
            + `<li>${options.labelDistance}: ${Math.round(c._stats.getDistance() * 100) / 100}km</li></ul>`,
        );
      });

      $('#data-computing').slideUp();
    });

    $('#data').chart({
      map,
      isSmallScreen: false,
      showTerrainSlope: options.showTerrainSlope,
      labelAltitude: options.labelAltitude,
      labelSlope: options.labelSlope,
      labelDistance: options.labelDistance,
      labelAltitudeMax: options.labelAltitudeMax,
      labelHeightDiffUp: options.labelHeightDiffUp,
      labelAltitudeMin: options.labelAltitudeMin,
      labelHeightDiffDown: options.labelHeightDiffDown,
    });
  },

  addTour(track, options) {
    if (track._map._imported) return; // Skip if some nodes were imported

    $.Shepherd.labelNext = options.labelNext;
    $.Shepherd.labelClose = options.labelClose;

    $.Shepherd.tour()
      .add('welcome', {
        text: $('#help-welcome')[0],
      })
      .add('layers', {
        text: $('#help-layers')[0],
        attachTo: {
          element:
            $('.leaflet-control-layers-expanded').length > 0
              ? $('.leaflet-control-layers-expanded')[0]
              : $('.GPlayerName').closest('.GPwidget')[0],
          on: 'left',
        },
      })
      .add('search', {
        text: $('#help-search')[0],
        attachTo: { element: $('.leaflet-control-geocoder')[0], on: 'right' },
      })
      .add('autotrace', {
        text: $('#help-autotrace')[0],
        attachTo: { element: $('#trackdrawer-add')[0], on: 'bottom' },
      })
      .add('straighttrace', {
        text: $('#help-straighttrace')[0],
        attachTo: { element: $('#trackdrawer-mode-line')[0], on: 'bottom' },
      })
      .start();

    track.on('TrackDrawer:done', () => {
      if (track.hasNodes(2) && !$.Shepherd.has(1)) {
        $.Shepherd.tour()
          .add('data', {
            text: $('#help-data')[0],
            attachTo: { element: $('#data')[0], on: 'top' },
          })
          .add('closeloop', {
            text: $('#help-closeloop')[0],
            attachTo: { element: $('#trackdrawer-closeloop')[0], on: 'bottom' },
          })
          .add('export', {
            text: $('#help-export')[0],
            attachTo: { element: $('#btn-export')[0], on: 'right' },
          })
          .start();
      }

      if (track.hasNodes(3) && !$.Shepherd.has(2)) {
        $.Shepherd.tour()
          .add('movemarker', {
            text: $('#help-movemarker')[0],
            attachTo: { element: $('.awesome-marker').last()[0], on: 'bottom' },
          })
          .add('deletemarker', {
            text: $('#help-deletemarker')[0],
            attachTo: { element: $('#trackdrawer-delete')[0], on: 'bottom' },
          })
          .add('promotemarker', {
            text: $('#help-promote')[0],
            attachTo: { element: $('#trackdrawer-promote')[0], on: 'bottom' },
          })
          .add('steps2', {
            beforeShowPromise() {
              return new Promise((resolve) => {
                const route = track.getSteps()[0].edges[0];
                const lngs = route.getLatLngs();
                const item = lngs[Math.floor(lngs.length / 2)];
                track.getSteps()[0].container.openPopup(item);
                resolve();
              });
            },
            text: $('#help-steps2')[0],
            attachTo: { element: $('.awesome-marker').eq(1)[0], on: 'right' },
          })
          .add('insert', {
            text: $('#help-insert')[0],
            attachTo: { element: $('#trackdrawer-insert')[0], on: 'bottom' },
          })
          .start();
      }
    });
  },
};
