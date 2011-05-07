
/* An object to provide command services by sending asynchronous
 * requests to the server.  It maintains a given number of connections
 * at all times. */
command = {
    requests: new Bucket(),
    num_requests: 5,
    request_id: 0,
    handlers: {},
    handler_id: 0,

    json_handler: function (text)
    {
        if (text.length==0)
            return;
        var msg = JSON.parse(text);
        if (msg && msg['id']!=null)
            command.requests.take(msg['id']);
        command.maintain_requests();
        if (msg['cmd']) {
            var hs = command.handlers[msg['cmd']];
            if (hs) for (h in hs)
                        hs[h](msg['cmd'], msg['args']);
        }
    },

    message_request: function ()
    {
        command.requests.put(command.request_id);
        http_request('wait_cmd', {'id': command.request_id++},
                     command.json_handler);
    },

    /* Called to make sure the required number of connections are
     * still active. */
    maintain_requests: function ()
    {
        if (command.ws) {
            if (command.ws.is_closed)
                command.open_websocket();
        }
        if (!command.ws || !command.ws.is_opened)
            while (command.requests.contents.length < command.num_requests)
                command.message_request();
    },

    /* Register a handler for a particular message address. Returns a
     * reference that must be passed to unregister. */
    register: function(address, func)
    {
        var h = command.handlers[address];
        if (!h) {
            h = {};
            command.handlers[address] = h;
        }
        h[command.handler_id] = func;
        return [address, command.handler_id++];
    },

    /* Unregister a function.  Parameter may be a reference returned
     * from command.register(), or a string containing the message
     * address. */
    unregister: function(handler)
    {
        if (typeof(handler)=="string") {
            delete command.handlers[handler];
            return;
        }
        var address = handler[0];
        var id = handler[1];
        var h = command.handlers[address];
        if (h[id])
            delete h[id];
        var size = 0;
        for (var key in h)
            if (h.hasOwnProperty(key)) size ++;
        if (size == 0)
            delete command.handlers[address];
    },

    /* Start the command service. */
    start: function ()
    {
        command.open_websocket();
        setTimeout(function() {command.maintain_requests();}, 100);
    },

    /* Send a message. */
    send: function (cmd, args)
    {
        if (command.ws && command.ws.is_opened)
        {
            command.ws.send(JSON.stringify({'cmd': cmd,
                                            'args': args ? args : []}));
        }
        else {
            http_request('send_cmd',
                         {'msg':
                          JSON.stringify({'cmd': cmd,
                                          'args': args ? args : []})},
                         function (text) {
                             command.json_handler(text);
                         });
        }
    },

    open_websocket: function()
    {
        command.ws = null;
        if ("WebSocket" in window) {
            var L = (''+window.location).split('/');
            if (L.length > 2)
                L=L[2];
            else
                L=L[0];
            command.ws = new WebSocket("ws://"+L+"/sock");
        }
        if (!command.ws) {
            if (console)
                console.log("Couldn't create web socket.");
            return;
        }
        command.ws.is_closed = false;
        command.ws.is_opened = false;
        command.ws.onopen = function() {
            console.log("websocket opened");
            command.ws.is_opened = true;
        }
        command.ws.onmessage = function(e) {
            command.json_handler(e.data);
        }
        command.ws.onerror = function(e) {
            console.log('websocket error: '+e.data);
        }
        command.ws.onclose = function(e) {
            console.log("websocket closed");
            command.ws.is_closed = true;
            command.ws.is_opened = false;
        }
    }
};
