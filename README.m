# Pixel Countdown Encoding

---

# Interface

_NOTE_ : Requires the 'pngjs' module

```
pce.import.png(<input>)
```

Input can be one of:
  * String (filepath to a PNG image)
  * object with the following keys:
    * height (number)
    * width (number)
    * pixels (array of [r,g,b,a] values)

Output is a `<DecodedImage>`

_NOTES:_
  * Each pixel must be grayscale (r=g=b & a=0) or entirely transparent (a=255)
  * Grayscale pixels are converted into one of the following colors: (based on r/g/b value)
    * Black < 48
    * Dark < 128
    * Light < 208
    * White < 256

```
pce.batch.encode(<input>)
```

Input must be an object with the following key/value pairs:
  * <name> : `<DecodedImage>`

Output is an object with the following key/value pairs:
  * table : `<EncodedTable>`
  * images : object with the following key/value pairs
    * <name> : `<EncodedImage>`
      * The <name> matches the input <name>


```
pce.batch.decode(<input>)
```

Input must be an object with the following key/value pairs:
  * table : `<EncodedTable>`
  * images : object with the following key/value pairs
    * <name> : `<EncodedImage>`

Output is an object with the following key/value pairs:
  * <name> : `<DecodedImage>`
    * The <name> matches the input <name>
---

# Classes

**<DecodedImage>**

Properties:
  * `height`
  * `width`
  * `pixels`
    * The pixels is an array of one of `'W','L','D','B','A'`
  * `hasAlpha`
  * `encode()`
    * Will encode and return an `<EncodedImage>`

**<EncodedImage>**

Properties:
  * `data`
    * The encoded value as a binary string
  * `decode()`
    * Will decode and return an `<DecodedImage>`

**<EncodedTable>**

Properties:
  * `data`
    * The encoded value as a ByteArray

---

# Encoding Formats

**Sprite Encoding (.pce)**

Header
  * height (8 bits)
  * width (8 bits)
  * hasAlpha (1 bit)
  * initialColor (<encodedColor>)
  * initialCountdown
    * Remaining colors in the following format (in order of appearance)
      * <encodedColor>
      * <encodedValue>

Body
  * Sequence of <encodedValue>s

Whenever a pixel color changes, the next <encodedValue> in the sequence belongs to the color that just ended

If an encoded sprite is self contained, the <encodedValue> represents the `counter`
If the encoded sprite uses a table, the <encodedValue> represents the index in the lookup Table (and the table contains the `counter`)

The `counter` is the number of pixels until that color appears again

**Table Encoding Format (.pcet)**

The table contains all referenced `counter` values sorted by appearance count

The `counter` values in the table are not encoded

The table is separated into 2 sections:
  * Single Byte section (contains all `counters` which fit into a single byte)
  * Double Byte section (contains all `counters` which don't fit into a single byte)

Header
  * Size of the 'single byte' portion of the table  (8 bits)

Body
  * Single Byte section
    * Each value uses 1 byte
  * Double Byte section
    * Each section uses 2 bytes

**Color Encoding Format**
  * The value of an encoded color is the index of the color in the following array:
    * [White, Light, Dark, Black, Alpha]
  * Length is 3 bits if hasAlpha, otherwise 2 bits

**Value Encoding Format**

Value are encoded in the following way:

`< Header >< 0 >< Data >`

The Header is simply an array of consecutive set bits.  The Header is finished when the unset bit (<0>) is encountered.

The bit length of the header indicates both the offset and the bit length of the Data.

The offset is the (summation of 2^n)-1 for n=0 to x, where x=bit lenth of the header.

The Data is a simple binary encoding of a number, with the bit length of x+1

The final value of the encoded is the sum of the offset and the data value.

---

Future Work:

- Importing more image formats
- Reading/Writing to file (both encoded and decoded)
- Work with non-grayscale