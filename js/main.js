"use strict";
var viewManager;
var mapProperties;
var sigFilter;
var saverLoader;
var netSelector;
var viewSelector;
var tooltip;

window.onload = init;           // Kick things off

/* The main program. */
function init() {
    // suppress right click context menu
    $('body').attr('oncontextmenu',"return false;");     

    // add the top menu wrapper
    $('body').append("<div class=propertiesDiv id='TopMenuWrapper'></div>");

    // add the view wrapper
    $('body').append("<div id='container'></div>");
    $('body').append("<div id='axes'>"+
                        "<div id='fdgCtl'>"+
                            "<div id='dampingSlider'>"+
                                "<div id='dampingSliderHandle' class='ui-slider-handle'></div>"+
                                "<span class='sliderTitle'>Damping:</span>"+
                            "</div>"+
                            "<div id='repulsionSlider'>"+
                                "<div id='repulsionSliderHandle' class='ui-slider-handle'></div>"+
                                "<span class='sliderTitle'>Signal repulsion:</span>"+
                            "</div>"+
                            "<div id='targetAttractionSlider'>"+
                                "<div id='targetAttractionHandle' class='ui-slider-handle'></div>"+
                                "<span class='sliderTitle'>Target attraction:</span>"+
                            "</div>"+
                            "<div id='devAttractionSlider'>"+
                                "<div id='devAttractionHandle' class='ui-slider-handle'></div>"+
                                "<span class='sliderTitle'>Device attraction:</span>"+
                            "</div>"+
                            "<div id='devDistanceSlider'>"+
                                "<div id='devDistanceHandle' class='ui-slider-handle'></div>"+
                                "<span class='sliderTitle'>Device distance:</span>"+
                            "</div>"+
                            "<div id='mapAttractionSlider'>"+
                                "<div id='mapAttractionHandle' class='ui-slider-handle'></div>"+
                                "<span class='sliderTitle'>Map attraction:</span>"+
                            "</div>"+
                            "<div id='mapLengthSlider'>"+
                                "<div id='mapLengthHandle' class='ui-slider-handle'></div>"+
                                "<span class='sliderTitle'>Map length:</span>"+
                            "</div>"+
                        "</div>"+
                        "<div id='yAxis'>"+
                            "<div id='yAxisMax'></div>"+
                            "<div id='yAxisLabel' class='axisLabel'></div>"+
                            "<table id='yAxisMenu' class='dropdown-content'></table>"+
                            "<div id='yAxisMin'></div>"+
                        "</div>"+
                        "<div id='xAxis'>"+
                            "<div id='xAxisMin'></div>"+
                            "<div id='xAxisLabel' class='axisLabel'></div>"+
                            "<table id='xAxisMenu' class='dropdown-content'></table>"+
                            "<div id='xAxisMax'></div>"+
                        "</div>"+
                     "</div>");

    // init the view
    $('#container').empty();
    tooltip = new Tooltip();
    viewManager = new ViewManager(document.getElementById('container'), database,
                                  tooltip);

    // init the top menu
    $('#TopMenuWrapper').empty()
    saverLoader = new SaverLoader(document.getElementById("TopMenuWrapper"),
                                  database, viewManager);
    viewSelector = new ViewSelector(document.getElementById("TopMenuWrapper"),
                                    viewManager);
    sigFilter = new SignalFilter(document.getElementById("TopMenuWrapper"),
                                 database, viewManager);
    mapProperties = new MapProperties(document.getElementById("TopMenuWrapper"),
                                      database, viewManager);
    netSelector = new NetworkSelector(document.getElementById("TopMenuWrapper"),
                                      database, viewManager);

    // init controller
    initMonitorCommands();
    initViewCommands();
    initMapPropertiesCommands();

    let resizing = false;
    window.onresize = function (e) {
        if (!resizing) {
            window.requestAnimationFrame(function() {
                viewManager.on_resize();
                resizing = false;
            });
            resizing = true;
        }
    }

    // Delay starting polling, because it results in a spinning wait
    // cursor in the browser.
    let index = 0;
    setInterval(
        function() {
            switch (index) {
            case 0:
                viewManager.on_resize();
                mapProperties.clearMapProperties();
                command.start();
                command.send('refresh');
                command.send('get_networks');
                command.send('subscribe', 'all_devices');
                command.send('add_devices');
                break;
            case 1:
                command.send('add_signals');
                command.send('add_links');
                break;
            case 2:
                command.send('add_maps');
                window.clearInterval(this);
            }
            index += 1;
        }, 250);
}

/**
 * initialize the event listeners for events triggered by the monitor
 */
function initMonitorCommands() {
    command.register("available_networks", function(cmd, args) {
        database.networkInterfaces.available = args;
        netSelector.update();
    });
    command.register("active_network", function(cmd, args) {
        database.networkInterfaces.selected = args
        netSelector.update();
    });
}

/**
 * initialize the event listeners for events triggered by the views
 */
function initViewCommands()
{
    $('body').on('keydown.list', function(e) {
        if (e.metaKey != true) {
            switch (e.which) {
                case 37:
                    // pan left
                    e.preventDefault();
                    viewManager.pan(null, null, 10, 0);
                    break;
                case 39:
                    // pan right
                    e.preventDefault();
                    viewManager.pan(null, null, -10, 0);
                    break;
                case 38:
                    // pan up
                    e.preventDefault();
                    viewManager.pan(null, null, 0, 10);
                    break;
                case 40:
                    // pan down
                    e.preventDefault();
                    viewManager.pan(null, null, 0, -10);
                    break;
            }
            return;
        }

        let new_view = null;
        let mp;
        switch (e.which) {
            case 49:
                /* 1 */
                new_view = 'chord';
                break;
            case 50:
                /* 2 */
                new_view = 'list';
                break;
            case 51:
                /* 3 */
                new_view = 'grid';
                break;
            case 52:
                /* 4 */
                new_view = 'canvas';
                break;
            case 53:
                /* 5 */
                new_view = 'graph';
                break;
            case 54:
                /* 6 */
                new_view = 'hive';
                break;
            case 55:
                /* 7 */
                new_view = 'parallel';
                break;
            case 56:
                /* 8 */
                new_view = 'console';
                break;
            case 79:
                e.preventDefault();
                saverLoader.fileOpenDialog();
                break;
            case 83:
                e.preventDefault();
                saverLoader.save();
            case 48:
                e.preventDefault();
                viewManager.resetPanZoom();
                break;
            case 187:
                // decrease zoom
                e.preventDefault();
                mp = viewManager.view.mapPane;
                viewManager.zoom(mp.cx, mp.cy, -10);
                break;
            case 189:
                // increase zoom
                e.preventDefault();
                mp = viewManager.view.mapPane;
                viewManager.zoom(mp.cx, mp.cy, 10);
                break;
            case 70:
                // "find": focus on signal filter
                e.preventDefault();
                sigFilter.activate();
                break;
            default:
//                console.log('key:', e.which);
        }
        if (new_view) {
            viewManager.switch_view(new_view);
        }
    });

    let wheeling = false;
    let pageX, pageY, deltaX, deltaY, zooming;
    document.addEventListener('wheel', function(e) {
        e.preventDefault();
        if (e.pageY < 80) {
            // not over container
            return;
        }
        pageX = e.pageX;
        pageY = e.pageY;
        deltaX = e.deltaX;
        deltaY = e.deltaY;
        zooming = e.ctrlKey;

        if (!wheeling) {
            window.requestAnimationFrame(function() {
                if (zooming) {
                    viewManager.zoom(pageX, pageY, deltaY);
                }
                else {
                    viewManager.pan(pageX, pageY, deltaX, deltaY);
                }
                wheeling = false;
            });
        }
        wheeling = true;
    }, {passive: false});
}

// allows anyone to call updateMapProperties by triggering an event on #container
function initMapPropertiesCommands() {
    // asks the view for the selected maps and updates the edit bar
    $("#container").on("updateMapProperties", function(e) {
        mapProperties.updateMapProperties();
    });

    // updated the properties for a specific map
    $("#container").on("updateMapPropertiesFor", function(e, key) {
        mapProperties.updateMapPropertiesFor(key);
    });
}

function select_obj(obj) {
    if (obj.selected)
        return false;
    obj.selected = true;
    if (obj.view instanceof MapPainter) obj.view.draw(0);
    return true;
}
