//++++++++++++++++++++++++++++++++++++++//
//            Mapper Class              //
//++++++++++++++++++++++++++++++++++++++//

// This class provides the functionality for creating and removing maps

class Mapper
{
    constructor() {}

    map(srckey, dstkey, props)
    {
        command.send('map', [srckey, dstkey, props])
    }

    unmap(srckey, dstkey)
    {
        command.send('unmap', [srckey, dstkey]);
    }
}

var mapper = new Mapper(); // make global instance
