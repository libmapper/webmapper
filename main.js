
function test_send()
{
    div = document.createElement('div');
    inp = document.createElement('input');
    inp.value = "Send /test,asdf,123";
    inp.type = "button";
    inp.onclick = function(){command.send('/test', ['asdf', 123]);}
    div.appendChild(inp);
    document.body.insertBefore(div, document.getElementById('output'));
}

/* The main program. */
function main()
{
    command.register("newdevice", function(cmd, args) {
        trace(cmd+", "+args.name);
    });

    command.start();

    test_send();
}

/* Kick things off. */
window.onload = main;
