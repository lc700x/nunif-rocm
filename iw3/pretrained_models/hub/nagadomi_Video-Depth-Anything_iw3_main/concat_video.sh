#!/bin/bash


if [ $# -eq 3 ]; then
    ffmpeg -i $1 -i $2 -filter_complex hstack -b:v 8M $3
else
   echo "concat_video.sh <left_video_path> <right_video_path> <output_video_path>"
   exit
fi

