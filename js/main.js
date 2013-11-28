"use strict";
var model = new LibMapperModel();

var view;						// holds the current view object
var viewIndex;					// index of current view
var viewData = new Array(3);	// data specific to the view, change 3 the number of views

var topMenu;

window.onload = init;			// Kick things off

/* The main program. */
function init()
{
	$('body').append("<div id='topMenuWrapper'></div>");	// add the top menu wrapper
    $('body').append("<div id='container'></div>");			// add the view wrapper
    $('body').attr('oncontextmenu',"return false;");		// ?

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
            command.send('all_connections');
            network_selection();
        }, 100);

}

/**
 * initialize the event listeners for events triggered by the views
 */
function initMonitorCommands()
{
    command.register("all_devices", function(cmd, args) {
        for (var d in args)
            model.devices.add(args[d].name, args[d]);
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
        command.send('get_signals_by_device_name', args.name);
        update_display();
    });
    command.register("all_signals", function(cmd, args) {
        for (var d in args)
            model.signals.add(args[d].device_name+args[d].name + '/_dir_'+args[d].direction, args[d]);
        update_display();
    });
    command.register("new_signal", function(cmd, args) {
        model.signals.add(args.device_name+args.name + '/_dir_'+args.direction, args);
        update_display();
    });
    command.register("del_signal", function(cmd, args) {
        model.signals.remove(args.device_name+args.name + '/_dir_'+args.direction);
        update_display();
    });
    command.register("all_links", function(cmd, args) {
        for (var l in args)
            model.links.add(args[l].src_name + '>' + args[l].dest_name, args[l]);
        update_display();
    });
    command.register("new_link", function(cmd, args) {
        model.links.add(args.src_name+'>'+args.dest_name, args);
        update_display();
    });
    command.register("del_link", function(cmd, args) {
        model.links.remove(args.src_name+'>' + args.dest_name);
        update_display();
    });
    command.register("all_connections", function(cmd, args) {
        for (var d in args)
            model.connections.add(args[d].src_name + '>' + args[d].dest_name, args[d]);
        update_display();
        for (var d in args)
            topMenu.updateConnectionPropertiesFor(args[d], view.get_selected_connections(model.connections));
    });
    command.register("new_connection", function(cmd, args) {
        model.connections.add(args.src_name + '>' + args.dest_name, args);
        update_display();
        topMenu.updateConnectionPropertiesFor(args, view.get_selected_connections(model.connections));
    });
    command.register("mod_connection", function(cmd, args) {
        model.connections.add(args.src_name + '>' + args.dest_name, args);
        update_display();
        topMenu.updateConnectionPropertiesFor(args, view.get_selected_connections(model.connections));
    });
    command.register("del_connection", function(cmd, args) {
        var conns = view.get_selected_connections(model.connections);
        model.connections.remove(args.src_name+'>'+args.dest_name);
        update_display();
        topMenu.updateConnectionPropertiesFor(args, conns);
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
	// requests links and connections from the selected source device (the selectedTab)
    $("#container").on("tab", function(e, selectedTab){
    	command.send('tab', selectedTab);
    });
    
    // request list of signals from the monitor for a specific device
    // deviceName = "/devicename"
    $("#container").on("getSignalsByDevice", function(e, deviceName){
        command.send('get_signals_by_device_name', deviceName);
    });
    
    // request links and connections from monitor from a specific device
    // deviceName = "/devicename"
    $("#container").on("get_links_or_connections_by_device_name", function(e, deviceName){
    	command.send('tab', deviceName);	//FIX
    });
    
    // link command
    // src = "/devicename"
    // dst = "/devicename"
    $("#container").on("link", function(e, src, dst){
        command.send('link', [src, dst]);
        console.log(src, dst);
    });
    
    // unlink command
    // src = "/devicename"
    // dst = "/devicename"
    $("#container").on("unlink", function(e, src, dst){
        command.send('unlink', [src, dst]);
    });
    
    // connect command
    // src = "/devicename/signalname"
    // dst = "/devicename/signalname"
    $("#container").on("connect", function(e, src, dst, args){
        command.send('connect', [src, dst, args]);
    });
    
    // disconnect command
    // src = "/devicename/signalname"
    // dst = "/devicename/signalname"
    $("#container").on("disconnect", function(e, src, dst){
        command.send('disconnect', [src, dst]);
    });
    
    // asks the view for the selected connections and updates the edit bar
    $("#container").on("updateConnectionProperties", function(e){
    	topMenu.updateConnectionProperties(view.get_selected_connections(model.connections));
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
	$("#topMenuWrapper").on("setConnection", function(e, args){
		command.send('set_connection', args);
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
    model.connections = new Assoc();
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



