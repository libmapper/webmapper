"use strict";
var model = new MapperModel();

var view;                       // holds the current view object
var viewIndex;                  // index of current view
var viewData = new Array(3);    // data specific to the view, change 3 the number of views

var topMenu;

window.onload = init;           // Kick things off

/* The main program. */
function init() {
    // add the top menu wrapper
    $('body').append("<div id='topMenuWrapper'></div>");

    // add the view wrapper
    $('body').append("<ul class='topTabs'>"+
                         "<li id='allDevices'>All Devices</li>"+
                     "</ul>"+
                     "<ul id='sidebar'>"+
                         "<li><span id='listButton' class='viewButton viewButtonsel'></span></li>"+
                         "<li><span id='graphButton' class='viewButton'></span></li>"+
                         "<li><span id='canvasButton' class='viewButton'></span></li>"+
                         "<li><span id='gridButton' class='viewButton'></span></li>"+
                         "<li><span id='hiveButton' class='viewButton'></span></li>"+
                         "<li><span id='balloonButton' class='viewButton'></span></li>"+
                     "</ul>"+
                     "<div id='container'></div>");
    $('body').attr('oncontextmenu',"return false;");     // ?

    // init the top menu
    topMenu = new TopMenu(document.getElementById("topMenuWrapper"), model);
    topMenu.init();

    // init controller
    initMonitorCommands();
    initViewCommands();
    initTopMenuCommands();

    // update container height based on height of top menu
    $('#container').css('height', 'calc(100% - ' + ($('.topMenu').height() + 5) + 'px)' );
    window.onresize = function (e) {
        $('#container').css('height', 'calc(100% - ' + ($('.topMenu').height() + 5) + 'px)' );
        view.on_resize();
    };

    // Delay starting polling, because it results in a spinning wait
    // cursor in the browser.
    let index = 0;
    setInterval(
        function() {
            switch (index) {
            case 0:
                switch_mode('list');
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
        model.networkInterfaces.available = args;
        topMenu.updateNetworkInterfaces(args);
    });
    command.register("active_network", function(cmd, args) {
        model.networkInterfaces.selected = args
        topMenu.updateNetworkInterfaces(args);
    });
}

/**
 * initialize the event listeners for events triggered by the views
 */
function initViewCommands()
{
    $('.viewButton').on("mousedown", function(e) {
        switch ($(this)[0].id) {
            case "listButton":
                switch_mode("list");
                break;
            case "graphButton":
                switch_mode("graph");
                break;
            case "gridButton":
                switch_mode("grid");
                break;
            case "hiveButton":
                switch_mode("hive");
                break;
            case "balloonButton":
                switch_mode("balloon");
                break;
        }
        $('.viewButton').removeClass("viewButtonsel");
        $(this).addClass("viewButtonsel");
    });

    $('#container').on('updateView', function(e) {
        view.redraw();
    });

    // from list view
    // requests links and maps from the selected device (tab)
    $("#container").on("tab", function(e, tab){
        if (tab != 'All Devices') {
            // retrieve linked destination devices
            model.links.each(function(link) {
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
    $("#container").on("link", function(e, src, dst){
        model.links.add({ 'src' : src, 'dst' : dst, 'num_maps': [0, 0] });
    });

    // unlink command
    // src = "devicename"
    // dst = "devicename"
    $("#container").on("unlink", function(e, src, dst){
        model.links.remove(src, dst);
    });

    // map command
    // src = "devicename/signalname"
    // dst = "devicename/signalname"
    $("#container").on("map", function(e, src, dst, args){
        command.send('map', [src, dst, args]);
    });

    // unmap command
    // src = "devicename/signalname"
    // dst = "devicename/signalname"
    $("#container").on("unmap", function(e, src, dst){
        command.send('unmap', [src, dst]);
    });

    // asks the view for the selected maps and updates the edit bar
    $("#container").on("updateMapProperties", function(e){
        topMenu.updateMapProperties();
    });

    // asks the view for the save button link (based on the active device)
    // currently implemented in List view only
    $("#container").on("updateSaveLocation", function(e){
        topMenu.updateSaveLocation(view.get_save_location());
    });
}

function initTopMenuCommands()
{
    $("#topMenuWrapper").on("switchView", function(e, viewID) {
        switch_mode(viewID);
    });
    $("#topMenuWrapper").on("setMap", function(e, args) {
        command.send('set_map', args);
    });
    $("#topMenuWrapper").on("refreshAll", function(e) {
        refresh_all();
    });
    $("#topMenuWrapper").on("selectNetwork", function(e, network) {
        command.send('select_network', network);
    });
}

function refresh_all() {
    model.clearAll();
    command.send('refresh');
}

/**
 * Called by the view selector to change the current view
 */
function switch_mode(newMode)
{
    if (view) {
        // save view settings
        if (typeof view.save_view_settings == 'function')
            viewData[viewIndex] = view.save_view_settings();
        
        // tell the view to cleanup (ex: removing event listeners)
        view.cleanup();
    }
    
    $('#container').empty();
    switch (newMode) {
        case 'list':
            view = new listView(model);
            viewIndex = 0;
            view.init();
            break;
        case 'graph':
            view = new GraphView(document.getElementById('container'), model);
            viewIndex = 1;
            view.init();
            break;
        case 'grid':
            view = new GridView(document.getElementById('container'), model);
            viewIndex = 2;
            $('#saveLoadDiv').removeClass('disabled');
            break;
        case 'hive':
            view = new HivePlotView(document.getElementById('container'), model);
            viewIndex = 3;
            view.init();
            view.on_resize();
            break;
        case 'balloon':
            view = new BalloonView(model);
            viewIndex = 4;
            view.init();
            break;
        default:
            //console.log(newMode);
    }

//    // load view settings (if any)
//    if (viewData[viewIndex]) {
//        if (typeof view.load_view_settings == 'function')
//            view.load_view_settings(viewData[viewIndex]);
//    }

    topMenu.clearMapProperties();
}
