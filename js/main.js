"use strict";
var model = new MapperModel();

var view;                       // holds the current view object
var viewIndex;                  // index of current view
var viewData = new Array(3);    // data specific to the view, change 3 the number of views

var topMenu;

window.onload = init;           // Kick things off

/* The main program. */
function init() {
    $('body').append("<div id='topMenuWrapper'></div>"); // add the top menu wrapper
    $('body').append("<div id='container'></div>");      // add the view wrapper
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
    setTimeout(
        function(){
            switch_mode('list');
            command.start();
            command.send('refresh');
            command.send('get_networks');
            command.send('subscribe', 'all_devices');
            command.send('add_devices');
            command.send('add_signals');
            command.send('add_links');
            command.send('add_maps');
            network_selection();
        }, 100);
}

/**
 * initialize the event listeners for events triggered by the monitor
 */
function initMonitorCommands() {
    command.register("add_devices", function(cmd, devs) {
//        console.log('add devices');
        for (var i in devs)
            model.devices.add(devs[i]);
        update_display();
    });
    command.register("del_device", function(cmd, dev) {
//        console.log('remove device');
        model.devices.remove(dev.name);
        update_display();
    });
    command.register("add_signals", function(cmd, sigs) {
//        console.log('add signals', sigs);
        for (var i in sigs)
            model.signals.add(sigs[i]);
        update_display();
    });
    command.register("del_signal", function(cmd, sig) {
//        console.log('remove signal');
        model.signals.remove(sig.name);
        update_display();
    });
    command.register("add_links", function(cmd, links) {
//        console.log('add links');
        for (var i in links)
            model.links.add(links[i]);
        update_display();
    });
    command.register("del_link", function(cmd, link) {
//        console.log('remove link');
        if (link && !link.local)
            model.links.remove(link);
        update_display();
    });
    command.register("add_maps", function(cmd, maps) {
//        console.log('add maps', maps);
        for (var i in maps) {
            maps[i].status = 'active';
            var key = model.maps.add(maps[i]);
            topMenu.updateMapPropertiesFor(key);
        }
        update_display();
    });
    command.register("del_map", function(cmd, map) {
//        console.log('remove map');
        var key = model.maps.remove(map);
        topMenu.updateMapPropertiesFor(key);
        update_display();
    });
    command.register("set_network", function(cmd, args) {
        model.networkInterfaces.selected = args;
        refresh_all();
    });
    command.register("active_network", function(cmd, args) {
        model.networkInterfaces.selected = args;
    });
}
/**
 * initialize the event listeners for events triggered by the views
 */
function initViewCommands()
{
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
        update_display();
    });

    // unlink command
    // src = "devicename"
    // dst = "devicename"
    $("#container").on("unlink", function(e, src, dst){
        model.links.remove(src, dst);
        update_display();
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
}

function refresh_all() {
    model.clearAll();
    view.update_display();
    command.send('refresh');
}

var updateCallable = true;
var updateTimeout;
function update_display() {
    if (updateCallable == false) {
        clearTimeout(updateTimeout);
    }
    updateCallable = false;
    updateTimeout = setTimeout(function() {
        view.update_display();
        topMenu.updateMapProperties();
    });
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
    switch(newMode) {
        case 'list':
            view = new listView(model);
            viewIndex = 0;
            view.init();
            break;
        case 'grid':
            view = new GridView(document.getElementById('container'), model);
            viewIndex = 1;
            $('#saveLoadDiv').removeClass('disabled');
            view.update_display();
            break;
        case 'hive':
            view = new HivePlotView(document.getElementById('container'), model);
            viewIndex = 2;
            view.on_resize();
            break;
        case 'balloon':
            view = new BalloonView(document.getElementById('container'), model);
            viewIndex = 3;
            view.init();
            if(viewData[viewIndex])
                  view.load_view_settings(viewData[viewIndex]);
            view.update_display();
            break;
        default:
            //console.log(newMode);
    }

    // load view settings (if any)
    if (viewData[viewIndex]) {
        if (typeof view.load_view_settings == 'function')
                view.load_view_settings(viewData[viewIndex]);
    }

    topMenu.clearMapProperties();
}

function network_selection()
{
    var menuOpen = false; // A variable storing the state of network selection

    $('body').on('mousedown', function(e) {
        if(e.which == 3) {              // A right click
            if(menuOpen) cleanup();     // Removes the menu and handlers if already open (multiple right clicks)
            select_network(e);
        }
    });

    function select_network(clickEvent) {
        command.send('get_networks');
        command.register('available_networks', function(cmd, args){
            model.networkInterfaces.available = args;
            $(  "<div id='networkMenu'>"+
                    "<table>"+
                        "Current Network: "+model.networkInterfaces.selected+
                        "<thead><th>Available Networks</th></thead>"+
                        "<tbody></tbody>"+
                    "</table></div>"
                ).insertAfter('#container');
            $('#networkMenu').css({'top': clickEvent.pageY, 'left': clickEvent.pageX});
            menuOpen = true;

            for (var i in model.networkInterfaces.available ) {
                $('#networkMenu tbody').append('<tr><td>'+model.networkInterfaces.available[i]+'</td></tr>');
            }

            $('#networkMenu td').on('click.networkSelect', function(e) {
                e.stopPropagation();
                command.send('select_network', $(this).text() );
                cleanup();
            });

            $('body').on('click.networkSelect', function(e) {cleanup();} );
        });
    }

    function cleanup() {
        $('#networkMenu').fadeOut(100).remove();
        $('*').off('.networkSelect');
        menuOpen = false;
        command.unregister('available_networks');
    }
}



