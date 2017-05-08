#!/bin/bash
for filename in *.kmz; do
  name=${filename%.kmz}
  unzip $filename -d $name
  rm $name\/*refl.png
  rm $filename
  cd $name
  zip ../$name\.kmz *
  cd ..
  rm -R $name
  echo $name
done
