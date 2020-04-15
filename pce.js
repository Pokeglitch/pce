/*
TODO -
pce - pixel countdown encoding
pcet - pixel countdown encoding table

Add comments and update README
Move index.js to 'test' folder and create new repo
*/

let fs = require('fs'),
    png = require('pngjs').PNG,
    memoizedEncoding = new Map();

// To convert the given number to a binary string with the given bit length
function toBinaryString(num, length){
    let str = num.toString(2);
    while(str.length < length) str = '0' + str;
    return str;
}

class EncodedImage{
    constructor(encodedString){
        this.data = encodedString;
    }
    decode(){
        return new SoloImageDecoder(this).decode();
    }
}

class DecodedImage {
    constructor(height, width, pixels, hasAlpha){
        this.height = height;
        this.width = width;
        this.pixels = pixels;
        this.hasAlpha = hasAlpha;
    }
    encode(){
        return new SoloImageEncoder(this).encode().compile();
    }
}

class LookupTable {
    constructor(){
        // The information for all values that this table will handle
        this.data = {};
        this.byteValuesLength = 0;
    }
    add(value){
        if( this.data[value] ){
            this.data[value].count++;
        }
        else{
            if(value < 256) this.byteValuesLength++;
            this.data[value] = { value, count : 1 }
        }
        
        return this.data[value]
    }

    // To compile this table by sorting the values based on appears
    // and then finding the binary representation for each value
    compile(){
        // Sort the data by appearance count (grouped by byte or word)
        this.sortedData = Object.values(this.data).sort( (a,b) => (a.value < 256) ^ (b.value < 256) ? a.value - b.value : b.count - a.count )

        let numBits = 1,
            prefix = '',
            nextIndex = Math.pow(2,numBits);

        // Encode the value of each index in the table
        // This encoded value will be pulled by the encoded image
        for(let i=0, index=0; i < this.sortedData.length; i++, index++){
            if( i == nextIndex ){
                nextIndex += Math.pow(2,++numBits);
                index = 0;
                prefix += '1';
            }
            this.sortedData[i].string = prefix + '0' + toBinaryString(index, numBits);
        }
        
        let output = [this.byteValuesLength];
        let i = 0;

        while(i<this.byteValuesLength){
            output.push(this.sortedData[i++].value);
        }
        while(i<this.sortedData.length){
            let value = this.sortedData[i++].value
            output.push( Math.floor(value/0x100), value%0x100);
        }
        
        return new EncodedTable(output);
    }
}

class EncodedTable {
    constructor(data){
        this.data = data;
    }
}

// To process the given image to compress to 4 colors (and maybe alpha)
class ImageEncoder {
    constructor(decodedImage){
        this.height = decodedImage.height;
        this.width = decodedImage.width;
        this.pixels = decodedImage.pixels;
        this.hasAlpha = decodedImage.hasAlpha;
        this.compilation = '';
        
        this.colors = ['W','L','D','B'];
        if( this.hasAlpha ) this.colors.push('A');
    }
    encode(){   
        let output = [],
            color = this.pixels[0],
            currentData = { color };

        this.firstEncounter = { [color] : true };
        this.lastEncounter = { [color] : currentData };

        this.addToHeader( toBinaryString(this.height,8), toBinaryString(this.width, 8), (this.hasAlpha ? '1' : '0'), this.encodeColor(color) );
    
        this.index = 0;
        while(++this.index < this.pixels.length){
            let color = this.pixels[this.index];
    
            if(currentData.color != color){
                // Update the end point and last encounter info for this color and store to output
                currentData.end = this.index-1;
                this.lastEncounter[currentData.color] = currentData;
                output.push(currentData);

                // Update the current color data
                currentData = { color };
                // Store the gap since the last time this color was encountered
                this.storeGapSinceLastEncounter(color);
            }
        }
        // Remove the 'previous data' for the last color
        delete this.lastEncounter[currentData.color] ;
        
        // Finish out the end for each color
        this.colors.forEach(color => this.storeGapSinceLastEncounter(color) );

        this.addToBody(...output.map( data => this.encodeNumber(data.next) ) );

        return this;
    }
    compile(){
        // Pad to a full byte
        while( this.compilation.length % 8 ) this.compilation += '0';
        return new EncodedImage(this.compilation);
    }
    // To store the gap since the last time the color was encountered (or add it to the header if this was the first time it was encountered)
    storeGapSinceLastEncounter(color){
        // If this color has not been encountered yet, add it to the header
        if(!this.firstEncounter[color]){
            this.firstEncounter[color] = true;
            this.addToHeader( this.encodeColor(color), this.encodeNumber(this.index) );
        }
        // If this color has been previously encountered, update the 'next' value for that prior data
        else if(this.lastEncounter[color]){
            this.lastEncounter[color].next = this.index - this.lastEncounter[color].end - 1;
        }
    }
    encodeColor(color){
        let str = this.colors.indexOf(color).toString(2);
        while(str.length < (this.hasAlpha ? 3 : 2) ) str = '0'+str;
        return str;
    }
}

class SoloImageEncoder extends ImageEncoder {
    constructor(decodedImage){
        super(decodedImage);
        this.header = '';
        this.body = '';
    }
    addToHeader(...args){
        args.forEach(value => this.header += value);
    }
    addToBody(...args){
        args.forEach(value => this.body += value);
    }
    compile(){
        this.compilation += this.header + this.body;
        return super.compile();
    }
    encodeNumber(num){
        if( memoizedEncoding.has(num) ){
            return memoizedEncoding.get(num);
        }
    
        let prefix = '',
            startIndex = 0,
            numBits = 1,
            nextIndex = Math.pow(2,numBits);
    
        while(num >= nextIndex){
            prefix += '1';
            startIndex = nextIndex;
            nextIndex += Math.pow(2,++numBits);
        }
        
        let encoding = prefix + '0' + toBinaryString(num-startIndex, numBits);
        memoizedEncoding.set(num, encoding);
        return encoding;
    }
}

class BatchImageEncoder extends ImageEncoder {
    constructor(decodedImage, table){
        super(decodedImage);
        this.table = table;
        this.header = [];
        this.body = [];
    }
    addToHeader(...args){
        this.header.push(...args);
    }
    addToBody(...args){
        this.body.push(...args);
    }
    compile(){
        this.header.concat(this.body).forEach( data => this.compilation += typeof data == 'string' ? data : data.string );
        return super.compile();
    }
    encodeNumber(value){
        return this.table.add(value);
    }
}

class ImageDecoder{
    constructor(encodedImage){
        this.data = encodedImage.data;
        this.index = 0;
        this.pixels = [];

        // Decode the header
        this.height = this.extractBinaryNumber(8);
        this.width = this.extractBinaryNumber(8);
        this.size = this.height*this.width;
        this.hasAlpha = this.isNextBitSet();

        this.colors = ['W','L','D','B'];
        if( this.hasAlpha ) this.colors.push('A');
    }
    decode(){
        // Extract the initial color data
        this.countdown = [{
            color : this.decodeColor()
        }];
        while(this.countdown.length < this.colors.length){
            this.countdown.push({
                color : this.decodeColor(),
                amount : this.getNextSkipAmount()
            });
        }

        // decode the body and populate the pixels
        while(true){
            // Get the current color and the number of pixels
            let color = this.countdown[0].color,
                amount = this.countdown[1].amount;

            // Add the number of the pixels for the current color
            for(let i=0; i<amount; i++) this.pixels.push(color);
            
            // Exit if the image is fulled decoded
            if(this.pixels.length == this.size) break;

            // Decrease the counter for all colors
            for(let i=1; i<this.countdown.length; i++) this.countdown[i].amount -= amount;

            // Get the new count for the color that was just added
            amount = this.getNextSkipAmount();

            // Insert the color that was just added back into the countdown list
            let i = 1;
            while(i<this.countdown.length){
                let data = this.countdown[i];
                if( amount < data.amount ) break;
                this.countdown[i-1] = data;
                i++;
            }
            this.countdown[i-1] = { color, amount };
        }

        return new DecodedImage(this.height, this.width, this.pixels, this.hasAlpha);
    }
    // To decode the given color
    decodeColor(){
        return this.colors[ this.extractBinaryNumber(this.hasAlpha ? 3 : 2) ];
    }
    // To extract a standard binary encoded integer with the given number of bits
    extractBinaryNumber(bitLength){
        return parseInt(this.data.substring(this.index, this.index+=bitLength), 2)
    }
    // To see if the next bit is set
    isNextBitSet(){
        return this.data[this.index++] === '1';
    }
}

class SoloImageDecoder extends ImageDecoder {
    // To extract the next encoded number value and decode it
    getNextSkipAmount(){
        let bitLength = 1, offset = 0;
        while( this.isNextBitSet() ) offset += Math.pow(2,bitLength++);
        return offset + this.extractBinaryNumber(bitLength);
    }
}

class BatchImageDecoder extends ImageDecoder {
    constructor(encodedImage, table){
        super(encodedImage);
        this.table = table.data;
    }
    getNextSkipAmount(){
        let bitLength = 1,
            index = 0,
            byteValuesLength = this.table[0];
        
        while( this.isNextBitSet() ) index += Math.pow(2,bitLength++);
        index += this.extractBinaryNumber(bitLength);
        
        if( index < byteValuesLength ){
            return this.table[index+1];
        }
        index += index-byteValuesLength;
        return this.table[index+1] * 0x100 + this.table[index+2];
    }
}

module.exports = {
    import : {
        png(input){
            if(typeof input == 'string'){
                input = png.sync.read( fs.readFileSync(input) );
            }
            else if( typeof input != 'object' || !(input.data instanceof Array) || typeof input.height != 'number' || typeof input.width != 'number' ){
                throw Error('Input must either be a path (string) or data object with keys:\n\theight (number), width (number), data (array)');
            }
            let height = input.height,
                width = input.width,
                pixels = [],
                hasAlpha = false;
    
            let i=0;
            while(i < input.data.length){
                let r = input.data[i++],
                    g = input.data[i++],
                    b = input.data[i++],
                    a = input.data[i++];
        
                if(a === 0){
                    pixels.push('A');
                    hasAlpha = true;
                }
                else if(a !== 255) throw Error('Invalid Alpha Value')
                else if(r !== g || r !== b) throw Error('Invalid Non-Grayscale Color')
                else pixels.push( r < 48 ? 'B' : r < 128 ? 'D' : r < 208 ? 'L' : 'W' );
            }

            return new DecodedImage(height, width, pixels, hasAlpha);
        },
        pce(){}
    },
    batch : {
        encode(input){
            let lookupTable = new LookupTable(),
                encodings = {}
                images = {};

            Object.keys(input).forEach(name => encodings[name] = new BatchImageEncoder(input[name], lookupTable).encode() );
            let table = lookupTable.compile();
            Object.keys(encodings).forEach( name => images[name] = encodings[name].compile() );

            return {table, images};
        },
        decode(table, input){
            let images = {};
            Object.keys(input).forEach(name => images[name] = new BatchImageDecoder(input[name], table).decode() );
            return images;
        }
    }
}