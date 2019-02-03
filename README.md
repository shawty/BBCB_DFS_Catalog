# BBCB_DFS_Catalog
A HTML based mini application, written in JavaScript to allow you to host BBC B Disk images on a website.

# What is it?
# -----------
Nothing particularly special, but if you have a collection of SSD based DFS disk image files from a BBC Micro (or emulator)
it allows you to list your image files on your website using nothing more than pure HTML (It doesn't need PHP/C#/NodeJS or anything similar)

It also allows you to list the files inside the image, and provides a means to download either the full image or just a
single file from inside the image.

Files are download with a name that preserves the BBC file attributes as follows:

<dir>_<name>_<load>_<exec>

<dir> is ommitted if the file is in the root '$' directory.

# How to use it
# -------------
There are 2 files 'index.html' and 'disks.json'.

index.html is the main viewing HTML page, drop it in a web accessable folder on your web server, then access it via a browser as you would for any normal web page.  DO BE AWARE though, that it does use Twitter Bootstrap and some modern HTML5 tech such as flexbox to help with the layout and styling, and it does require JavaScript to work too, so it needs a reasonably modern browser circa the last 5 years or so.

**PLEASE NOTE:** it CANNOT be run directly from disk, as the security model built into modern browsers will not allow the code in the page to load the disks.json file.  There are ways round this, by embedding the json data directly in the HTML web page, however you will still then have the same problem loading the disk images, if your running this locally you'll need to run it via a server such as "Apache", "Nginx", "Light HTTPD" or "IIS".

open the 'disks.json' file in a text editor of your choice, and you'll see that it's a simple javascript data format.

Each line is enclosed in [] and seperated by commas, each line forms a single javascript object that describes a single disk image EG:

    { "name": "tbi55-1.ssd", "diskTitle": "Dreamscape Demo", "diskType": "Single Sided" },

in this example, the disk image name is "tbi55-1.ssd" the title (Displayed in the table in the HTML) is "Dreamscape Demo" and the type is "Single Sided"

At present, the code ONLY supports single sided disks.  I may at some point get time to expand it to double sided, and even ADFS formatted disks, but for now this is all I had time for.

once you've listed your disks in 'disks.json', place the file in the same folder as your html file, create a folder called 'disks' and add your images into that folder.

When done, point your browser at the server you placed it on, and you should be able to see your disks and thier contents listed.

The code in this repository is ready to go, and set up to host the disk images of my software published on 8BS.COM.
