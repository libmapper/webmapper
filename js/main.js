"use strict";
var database = new MapperDatabase();

var viewManager;
var mapProperties;
var devFilter;
var saverLoader;
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
    $('body').append("<div id='axes'></div>");

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
    devFilter = new SignalFilter(document.getElementById("TopMenuWrapper"),
                                 database, viewManager);
    mapProperties = new MapProperties(document.getElementById("TopMenuWrapper"),
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
        mapProperties.updateNetworkInterfaces(args);
    });
    command.register("active_network", function(cmd, args) {
        database.networkInterfaces.selected = args
        mapProperties.updateNetworkInterfaces(args);
    });
}

/**
 * initialize the event listeners for events triggered by the views
 */
function initViewCommands()
{
    $('body').on('keydown.list', function(e) {
        if (e.metaKey != true)
            return;

        let new_view = null;
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
            case 48:
                e.preventDefault();
                viewManager.resetPanZoom();
                break;
//            default:
//                console.log('key:', e.which);
        }
        if (new_view) {
            viewManager.switch_view(new_view);
        }
    });

    $('#container').on('updateView', function(e) {
        viewManager.draw();
    });

    $('#container').on('scrolll', function(e) {
        viewManager.draw(0);
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
    });

    // from list view
    // requests links and maps from the selected device (tab)
    $("#container").on("tab", function(e, tab){
        if (tab != 'All Devices') {
            // retrieve linked destination devices
            database.links.each(function(link) {
                if (tab == link.src)
                    command.send('subscribe', link.dst);
                else if (tab == link.dst)
                    command.send('subscribe', link.src);
            });
            command.send('subscribe', tab);
        }
    });

    // link command
    // src = "devicename"
    // dst = "devicename"
    $("#container").on("link", function(e, src, dst) {
        database.links.add({ 'src' : src, 'dst' : dst, 'num_maps': [0, 0] });
    });

    // unlink command
    // src = "devicename"
    // dst = "devicename"
    $("#container").on("unlink", function(e, src, dst) {
        database.links.remove(src, dst);
    });

    // map command
    // src = "devicename/signalname"
    // dst = "devicename/signalname"
    $("#container").on("map", function(e, src, dst, args) {
        command.send('map', [src, dst, args]);
    });

    // unmap command
    // src = "devicename/signalname"
    // dst = "devicename/signalname"
    $("#container").on("unmap", function(e, src, dst) {
        command.send('unmap', [src, dst]);
    });

    // asks the view for the selected maps and updates the edit bar
    $("#container").on("updateMapProperties", function(e) {
        mapProperties.updateMapProperties();
    });

    // updated the properties for a specific map
    $("#container").on("updateMapPropertiesFor", function(e, key) {
        mapProperties.updateMapPropertiesFor(key);
    });

    // asks the view for the save button link (based on the active device)
    // currently implemented in List view only
    $("#container").on("updateSaveLocation", function(e) {
        mapProperties.updateSaveLocation(viewManager.get_save_location());
    });

}

function initMapPropertiesCommands()
{
    $("#TopMenuWrapper").on("setMap", function(e, args) {
        command.send('set_map', args);
    });
    $("#TopMenuWrapper").on("refreshAll", function(e) {
        refresh_all();
    });
    $("#TopMenuWrapper").on("selectNetwork", function(e, network) {
        command.send('select_network', network);
    });
}

function refresh_all() {
    database.clearAll();
    command.send('refresh');
}

function select_obj(obj) {
    if (obj.selected)
        return false;
    obj.selected = true;
    obj.view.draw();
    return true;
}
