"use strict";
var model = new LibMapperModel();

var view;                       // holds the current view object
var viewIndex;                  // index of current view
var viewData = new Array(3);    // data specific to the view, change 3 the number of views

var topMenu;

window.onload = init;           // Kick things off

/* The main program. */
function init()
{
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
            command.send('get_networks');
            command.send('all_devices');
            command.send('all_signals');
            command.send('all_links');
            command.send('all_maps');
            network_selection();
        }, 100);
}

/**
 * initialize the event listeners for events triggered by the monitor
 */
function initMonitorCommands()
{
    command.register("all_devices", function(cmd, args) {
        for (var d in args) {
            model.devices.add(args[d].name, args[d]);
        }
        update_display();
    });
    command.register("new_device", function(cmd, args) {
        model.devices.add(args.name, args);
        update_display();
    });
    command.register("del_device", function(cmd, args) {
        model.devices.remove(args.name);
        update_display();
    });
    command.register("mod_device", function(cmd, args) {
        // Remove original device
        model.devices.remove(args.name);
        // Remove all child signals before syncing
        // var sigs = model.signals.keys();
        // for (var i in sigs ) {
        //     if ( sigs[i].search(args.name) == 0 ) {
        //         model.signals.remove(sigs[i]);
        //     }
        // }
        model.devices.add(args.name, args);
        update_display();
    });
    command.register("all_signals", function(cmd, args) {
        for (var d in args) {
            model.signals.add(args[d].device+'/'+args[d].name, args[d]);
        }
        update_display();
    });
    command.register("new_signal", function(cmd, args) {
        model.signals.add(args.device+'/'+args.name, args);
        update_display();
    });
    command.register("mod_signal", function(cmd, args) {
        model.signals.add(args.device+'/'+args.name, args);
        update_display();
    });
    command.register("del_signal", function(cmd, args) {
        model.signals.remove(args.device+'/'+args.name);
        update_display();
    });
    command.register("all_links", function(cmd, args) {
        for (var l in args)
            model.links.add(args[l].src + '>' + args[l].dst, args[l]);
        update_display();
    });
    command.register("new_link", function(cmd, args) {
        model.links.add(args.src+'>'+args.dst, args);
        update_display();
    });
    command.register("mod_link", function(cmd, args) {
        model.links.add(args.src+'>'+args.dst, args);
        update_display();
    });
    command.register("del_link", function(cmd, args) {
        var link = model.getLink(args.src, args.dst);
        if (link && !link.local)
            model.links.remove(args.src+'>' + args.dst);
        update_display();
    });
    command.register("all_maps", function(cmd, args) {
        for (var d in args)
            model.maps.add(args[d].src + '>' + args[d].dst, args[d]);
        update_display();
        for (var d in args)
            topMenu.updateMapPropertiesFor(args[d]);
    });
    command.register("new_map", function(cmd, args) {
        model.maps.add(args.src + '>' + args.dst, args);
        update_display();
        topMenu.updateMapPropertiesFor(args);
    });
    command.register("mod_map", function(cmd, args) {
        model.maps.add(args.src + '>' + args.dst, args);
        update_display();
        topMenu.updateMapPropertiesFor(args);
    });
    command.register("del_map", function(cmd, args) {
        model.maps.remove(args.src+'>'+args.dst);
        update_display();
        topMenu.updateMapPropertiesFor(args);
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
    // requests links and maps from the selected source device (the selectedTab)
    $("#container").on("tab", function(e, selectedTab){
        if (selectedTab != 'All Devices') {
            // retrieve linked destination devices
            model.getLinked(selectedTab);
            for (var i in model.getLinked(selectedTab))
                command.send('subscribe', i);
        }
        command.send('subscribe', selectedTab);
    });

    // link command
    // src = "/devicename"
    // dst = "/devicename"
    $("#container").on("link", function(e, src, dst){
        model.links.add(src + '>'+ dst, { 'src' : src, 'dst' : dst,
                        'num_maps': [0, 0] });
        update_display();
    });

    // unlink command
    // src = "/devicename"
    // dst = "/devicename"
    $("#container").on("unlink", function(e, src, dst){
        command.send('unlink', [src, dst]);
        model.links.remove(src + '>' + dst);
        update_display();
    });

    // map command
    // src = "/devicename/signalname"
    // dst = "/devicename/signalname"
    $("#container").on("map", function(e, src, dst, args){
        command.send('map', [src, dst, args]);
    });

    // unmap command
    // src = "/devicename/signalname"
    // dst = "/devicename/signalname"
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
    $("#topMenuWrapper").on("switchView", function(e, viewID){
        switch_mode(viewID);
    });
    $("#topMenuWrapper").on("setMap", function(e, args){
        command.send('set_map', args);
    });
    $("#topMenuWrapper").on("refreshAll", function(e){
        refresh_all();
    });
}

function refresh_all()
{
    model.devices = new Assoc();
    model.signals = new Assoc();
    model.links = new Assoc();
    model.maps = new Assoc();
    view.update_display();
    command.send('refresh');
}

var updateCallable = true;
var updateTimeout;
function update_display() {
    if(updateCallable == false) {
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
    if(view)
    {
        // save view settings
        if(typeof view.save_view_settings == 'function')
            viewData[viewIndex] = view.save_view_settings();
        
        // tell the view to cleanup (ex: removing event listeners)
        view.cleanup();
    }
    
    $('#container').empty();
    switch(newMode)
    {
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
    if(viewData[viewIndex]){
        if(typeof view.load_view_settings == 'function')
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



