let fs = require('fs'),
    pce = require('../pce.js'),
    imageNames = new Set(fs.readdirSync('./images').map(x => x.replace(/\.[^.]*$/, ''))),
    images = {},
    soloSize = 0;
    
function compareArrays(arr1, arr2, name){
    if( arr1.pixels.length !== arr2.pixels.length ){
        console.log('No Match', name, arr1.pixels.length, arr2.pixels.length);
    }
    else{
        let match = true;
        for(let i=0; i<arr1.pixels.length; i++){
            if( arr1.pixels[i] !== arr2.pixels[i]){
                console.log('No Match', name, i, arr1.pixels[i], arr2.pixels[i]);
                match = false;
                return;
            }
        }
        //if(match) console.log('Match', name, arr1.pixels.length)
    }
}

for(let name of imageNames){
    let image = pce.import.png(`./images/${name}.png`),
        encodedImage = image.encode(),
        decodedImage = encodedImage.decode();
    soloSize += encodedImage.data.length/8;
    images[name] = image;
    compareArrays(decodedImage, image, name);
}

let encodedData = pce.batch.encode(images),
    decodedData = pce.batch.decode(encodedData.table, encodedData.images),
    batchSize = encodedData.table.data.length;
for(let name of imageNames){
    batchSize += encodedData.images[name].data.length/8;
    compareArrays(decodedData[name], images[name], name);
}

console.log('Solo Size:', soloSize)
console.log('Batch Size:', batchSize)
