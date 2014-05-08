#!/bin/bash
#
# RESTo
# 
#  RESTo - REstful Semantic search Tool for geOspatial 
# 
#  Copyright 2013 Jérôme Gasperi <https://github.com/jjrom>
# 
#  jerome[dot]gasperi[at]gmail[dot]com
#  
#  
#  This software is governed by the CeCILL-B license under French law and
#  abiding by the rules of distribution of free software.  You can  use,
#  modify and/ or redistribute the software under the terms of the CeCILL-B
#  license as circulated by CEA, CNRS and INRIA at the following URL
#  "http://www.cecill.info".
# 
#  As a counterpart to the access to the source code and  rights to copy,
#  modify and redistribute granted by the license, users are provided only
#  with a limited warranty  and the software's author,  the holder of the
#  economic rights,  and the successive licensors  have only  limited
#  liability.
# 
#  In this respect, the user's attention is drawn to the risks associated
#  with loading,  using,  modifying and/or developing or reproducing the
#  software by the user in light of its specific status of free software,
#  that may mean  that it is complicated to manipulate,  and  that  also
#  therefore means  that it is reserved for developers  and  experienced
#  professionals having in-depth computer knowledge. Users are therefore
#  encouraged to load and test the software's suitability as regards their
#  requirements in conditions enabling the security of their systems and/or
#  data to be ensured and,  more generally, to use and operate it in the
#  same conditions as regards security.
# 
#  The fact that you are presently reading this means that you have had
#  knowledge of the CeCILL-B license and that you accept its terms.
#  
HTTPS=0
PHYSICAL=0
usage="\n## Delete a collection from RESTo database\n\n  Usage $0 -c <Collection name> -u <username:password> [-p (if set physically delete collection) -s (use https if set)]\n\n  !!!! WARNING - IF -p OPTION IS SET, THE COLLECTION DATABASE AND ALL ITS CONTENT WILL BE DELETED !!!!\n"
while getopts "spc:u:h" options; do
    case $options in
        u ) AUTH=`echo $OPTARG`;;
        c ) COLLECTION=`echo $OPTARG`;;
        p ) PHYSICAL=1;;
        s ) HTTPS=1;;
        h ) echo -e $usage;;
        \? ) echo -e $usage
            exit 1;;
        * ) echo -e $usage
            exit 1;;
    esac
done
if [ "$COLLECTION" = "" ]
then
    echo -e $usage
    exit 1
fi

if [ "$HTTPS" = "1" ]
then
    curl -k --get -X DELETE -d "physical=$PHYSICAL" https://$AUTH@localhost/resto/$COLLECTION
else
    curl --get -X DELETE -d "physical=$PHYSICAL" http://$AUTH@localhost/resto/$COLLECTION
fi
echo ""
