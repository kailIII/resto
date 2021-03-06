<?php

/*
 * RESTo
 * 
 * RESTo - REstful Semantic search Tool for geOspatial 
 * 
 * Copyright 2013 Jérôme Gasperi <https://github.com/jjrom>
 * 
 * jerome[dot]gasperi[at]gmail[dot]com
 * 
 * 
 * This software is governed by the CeCILL-B license under French law and
 * abiding by the rules of distribution of free software.  You can  use,
 * modify and/ or redistribute the software under the terms of the CeCILL-B
 * license as circulated by CEA, CNRS and INRIA at the following URL
 * "http://www.cecill.info".
 *
 * As a counterpart to the access to the source code and  rights to copy,
 * modify and redistribute granted by the license, users are provided only
 * with a limited warranty  and the software's author,  the holder of the
 * economic rights,  and the successive licensors  have only  limited
 * liability.
 *
 * In this respect, the user's attention is drawn to the risks associated
 * with loading,  using,  modifying and/or developing or reproducing the
 * software by the user in light of its specific status of free software,
 * that may mean  that it is complicated to manipulate,  and  that  also
 * therefore means  that it is reserved for developers  and  experienced
 * professionals having in-depth computer knowledge. Users are therefore
 * encouraged to load and test the software's suitability as regards their
 * requirements in conditions enabling the security of their systems and/or
 * data to be ensured and,  more generally, to use and operate it in the
 * same conditions as regards security.
 *
 * The fact that you are presently reading this means that you have had
 * knowledge of the CeCILL-B license and that you accept its terms.
 * 
 */

/**
 * 
 * Query storage module
 * 
 * Store input query into resto database
 * 
 */
class QueryStorage {
   
    private $dbh;
    private $profile;
    
    /**
     * Constructor
     * 
     * @param Object $R RESTo instance
     */
    public function __construct($R) {
        $config = $R->getModuleConfig('QueryStorage');
        $this->profile = $R->getUser()->getProfile();
        if ($config && $config['activate']) {
            $dbConnector = $R->getDatabaseConnectorInstance();
            if (isset($config['db']) && is_array($config['db'])) {
                $dbConnector->update($config['db']);
            }
            $this->dbh = $dbConnector->getConnection(true);
        }
    }

    /**
     * 
     * Store query into resto database
     * 
     * @param string $query
     * @return boolean
     */
    final public function store($query) {
        
        if (!$this->dbh) {
            return false;
        }
        
        if (!is_array($query)) {
            return false;
        }
        
        $values = array(
            "'" . pg_escape_string($query['service']) . "'",
            "'" . pg_escape_string($query['collection']) . "'",
            "'" . pg_escape_string($query['resource']) . "'",
            $query['realquery'] ? "'" . pg_escape_string(json_encode($query['realquery'])) . "'" : "null",
            "now()",
            "'" . $_SERVER['REMOTE_ADDR'] . "'",
            "'" . pg_escape_string($query['url']) . "'",
            $this->profile['userid']
        );

        return pg_query($this->dbh, 'INSERT INTO admin.history (service,collection,query,realquery,querytime,ip,url,userid) VALUES (' . join(',', $values) . ')');

    }

}