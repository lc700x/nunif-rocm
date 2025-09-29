#!/bin/bash


if [ $# -eq 2 ]; then
    ffmpeg -i $1 -i $2 -filter_complex psnr -an -f null -
else
   echo "diffvideo.sh video1 video2"
   exit
fi
