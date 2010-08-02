
/* The main program. */
function main()
{
    OSC.register("/test", function(path, types, args) {
        trace(path+','+types+",["+args+"]");
    });

    OSC.start();
}

/* Kick things off. */
window.onload = main;
