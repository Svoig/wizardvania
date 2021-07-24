const GAME_SCALE = 3;
const CUTOFF_DISTANCE = 500;

const BULLET_SPEED = 300;
const VORTEX_SPEED = 25;
const PLAYER_MOVE_SPEED = 125;
const PLAYER_BOOST_SPEED = 200;
const PLAYER_JUMP_FORCE = 250;
const MAX_VELOCITY = 200;
const TILE_UNIT = 10;
const GRAVITY = 980;
const GOBLIN_JUMP_FORCE = 200;
const AIR_BLAST_FORCE = 50;
const LAVA_BUBBLE_JUMP_FORCE = 300;
const BULLET_STRENGTH = 1;
const BOULDER_STRENGTH = 2;
const FIREBALL_STRENGTH = 2;

const STATUS_TIMEOUT = 2;

// See https://stackoverflow.com/questions/27078285/simple-throttle-in-js
function throttle(cb, timeout) {
    let waiting = false;
    return () => {
        if (!waiting) {
            waiting = true;
            cb();
            setTimeout(() => {
                waiting = false;
            }, timeout);
        }
    }
}


kaboom({
    global: true,
    fullscreen: true,
    scale: GAME_SCALE,
    debug: true,
    clearColor: [0, 0, 0, 1],
});

loadSprite("status", "status.png");

const FIRE = "fire";
const WATER = "water";
const EARTH = "earth";
const AIR = "air";
const NONE = "none"; // Just for player gun

const ELEMENTS = [FIRE, WATER, EARTH, AIR];

const spellNames = {
    [FIRE]: "Fireball",
    [WATER]: "Ice spear",
    [EARTH]: "Boulder",
    [AIR]: "Tornado",
    [NONE]: "Crossbow"
}

const PLAYER_STATE = {
    color: color(1.0, 0, 0),
    health: 3,
    maxHealth: 3,
    maxBoosts: 1,
    numBoosts: 1,
    tempBoosts: 0,
    moveSpeed: PLAYER_MOVE_SPEED,
    score: 0,
    direction: 1, // Aiming direction. 1 for right, -1 for left
    hasRemoteControl: false,
    ammoElement: NONE,
    availableAmmos: [NONE],
    // Status effects
    isRockShocked: false,
    isFreezing: false,
    isBurning: false,
};

// COLORS
const TERRAIN_COLOR_FIRE = color();
const TERRAIN_COLOR_WATER = color();
const TERRAIN_COLOR_AIR = color();
const TERRAIN_COLOR_EARTH = color();
const LAVA_BUBBLE_COLOR = color(0.85, 0.25, 0.0);
const ICICLE_COLOR = color(0, 0.25, 0.85);
const EARTH_SPIKE_COLOR = color(0.25, 0.25, 0);
const METAL_SPIKE_COLOR = color(0.25, 0.25, 0.25);
const BOULDER_COLOR = color(0.55, 0.35, 0.35);
const FIREBALL_COLOR = color(0.75, 0.2, 0.2);
const VORTEX_COLOR = color(0.85, 0.85, 0.85);
const ICE_LANCE_COLOR = color(0, 0, 1);

function createStatusIndicator(color, parent) {
    const indicator = add([
        // sprite("status"),
        rect(TILE_UNIT, TILE_UNIT),
        origin("center"),
        pos(parent.pos.x - (TILE_UNIT / 2),
            parent.pos.y - (TILE_UNIT / 2)),
        color,
        layer("effects")
    ]);

    let direction = 1;

    indicator.action(() => {
        indicator.pos = parent.pos;

        if (indicator.height > TILE_UNIT * 1.5) {
            direction = -1;
        } else if (indicator.height < 0.25) {
            direction = 1;
        }

        indicator.width += 0.2 * direction;
        indicator.height += 0.2 * direction;

        if (!parent.exists()) {
            destroy(indicator);
        }
    });

    wait(STATUS_TIMEOUT, () => {
        destroy(indicator);
    })

    return indicator;
}


function generateBragText({ tookDamage, defeatedEnemy, collectedItem, retried }) {
    const bragIntros = [
        `As I stepped over the threshold into the chamber, I was filled with\ncomplete confidence in my exemplary skills and finesse.\n`,
        `This room was filled with horrific dangers the likes of which I\nhad never seen.\n`,
        `A dark, cavernous chamber loomed before me.\n`,
        `Peering into the darkness, I wondered what treacherous\ntraps lay ahead this time.\n`
    ];

    const tookDamageBrags = [
        `I was invincible! None of the nightmarish dangers even came close to me.\n`,
        `I skillfully avoided every danger with, if I may say so, poise and elegance.\n`,
        `The dangers swarmed around me, but nothing could so much as lay a finger on me!\n`
    ];

    const defeatedNoEnemiesBrags = [
        `Every foul, slobbering monster fell before my might.\n`,
        `Not one soulless demon was left standing by the time I approached the exit.\n`,
        `My unparalleled skill and power made short work of\nthe horde of monsters lurking here.\n`
    ];

    const collectedNoItemBrags = [
        `I found treasures in that room you couldn't even imagine!\n`,
        `This chamber was an absolute treasure trove! I could hardly carry it all!\n`,
        `I found enough treasure in that room to buy the whole town twice over!\n`
    ];

    const concludingBrags = [
        `Having risked life and limb, I am one step closer...\nthat treasure is mine!`,
        `My life was hanging by a thread, but nothing could sway me from my quest!`,
        `Another exhilirating challenge, but of course it was no match for me!`
    ];

    let bragText = choose(bragIntros);

    if (tookDamage || retried) {
        bragText += choose(tookDamageBrags);
    }

    if (!defeatedEnemy) {
        bragText += choose(defeatedNoEnemiesBrags);
    }

    if (!collectedItem) {
        bragText += choose(collectedNoItemBrags);
    }

    bragText += choose(concludingBrags);

    return bragText;
}

/**
 * Choose a random element to be used to create different hazards, etc for each attempt at a level
 * @param {string} lastElement The element that was active in the level just played
 * @returns {string} The new element to be used in the level
 */
const getElement = (lastElement) => {
    // Return value from query param if present
    if (elementOverride) {
        return elementOverride;
    }
    // Filter out the last element so you never get a back-to-back repeat
    const filteredElements = ELEMENTS.filter(e => e !== lastElement);

    return choose(filteredElements);
}

const getTerrainColorForElement = (element) => {
    switch (element) {
        case FIRE:
            return color(0.45, 0.1, 0.1);
        case WATER:
            return color(0.1, 0.1, 0.45);
        case EARTH:
            return color(0.35, 0.15, 0.15);
        case AIR:
            return color(0.45, 0.45, 0.45);
    }
}

const getElementalColor = (element) => {
    switch (element) {
        case FIRE:
            return color(0.65, 0.1, 0.1);
        case WATER:
            return color(0.1, 0.1, 0.65);
        case EARTH:
            return color(0.45, 0.25, 0.25);
        case AIR:
            return color(0.65, 0.65, 0.65);
    }
}

const getElementalResistanceTag = (element) => {
    switch (element) {
        case FIRE:
            return "fireproof";
        case WATER:
            return "iceproof";
        case EARTH:
            return "boulderproof";
        case AIR:
            return "vortexproof";
    }
}

const getHazardTerrainForElement = (element) => {
    switch (element) {
        case FIRE:
            return [rect(TILE_UNIT, TILE_UNIT), color(1.0, 0.75, 0), solid(), "lava", "kill"]; // Lava
        case WATER:
            return [rect(TILE_UNIT, TILE_UNIT), color(0, 1, 1), solid(), "terrain", "ice", "slippery"]; // Ice
        case EARTH:
            return [rect(TILE_UNIT, TILE_UNIT), color(0.15, 0.1, 0.1), solid(), "terrain", "standardTerrain", "crumblingBlock"]; // Crumbling block
        case AIR:
            return [rect(TILE_UNIT, TILE_UNIT), color(0.75, 0.75, 0.75), "airBlast"]; // Air blast
        default:
            return [rect(TILE_UNIT, TILE_UNIT), color(0, 0, 0, 0), "pit"]; // Empty pit
    }
}

const getHazardForElement = (element) => {
    switch (element) {
        case FIRE:
            return [rect(TILE_UNIT, TILE_UNIT), LAVA_BUBBLE_COLOR, "ember", solid(), { canJump: true, strength: 1 }];
        case WATER:
            return [rect(TILE_UNIT, TILE_UNIT), ICICLE_COLOR, solid(), "icicle", "ice", { canFall: true, strength: 1 }];
        case EARTH:
            return [rect(TILE_UNIT, TILE_UNIT), EARTH_SPIKE_COLOR, solid(), "earthSpike", { strength: 0.25 }];
        case AIR:
            return [rect(TILE_UNIT, TILE_UNIT), color(0, 0, 0, 0), "pit"]; // Empty pit

    }
}


// Keys
const UP = "w";
const RIGHT = "d";
const DOWN = "s";
const LEFT = "a";
const SHOOT = "space";
const BOOST = "shift";
const AIM = ".";
const AMMO_CYCLE_BACK = ["up", "left"];
const AMMO_CYCLE_FORWARD = ["down", "right"];

// Reusable components for creating things dynamically
const goalComponents = [rect(TILE_UNIT / 2, TILE_UNIT / 2), origin("center"), "goal"];
const respawningExtraBoostComponents = [rect(5, 5), color(1.0, 0, 1.0), "respawningExtraBoost"];
const explosionComponents = [rect(TILE_UNIT, TILE_UNIT), color(1, 1, 1), origin("center"), "explosion"];
const coinComponents = [rect(5, 5), color(1.0, 1.0, 0), "coin"];
const extraBoostComponents = [rect(5, 5), color(0, 1.0, 1.0), "extraBoost"];
const majorHealthPotionComponents = [rect(TILE_UNIT, TILE_UNIT), color(1.0, 0, 0.5), body(), { strength: 3 }, "majorHealthPotion", "healthPotion", "potion"];
const minorHealthPotionComponents = [rect(5, 5), color(1.0, 0, 0.5), body(), { strength: 1 }, "minorHealthPotion", "healthPotion", "potion"];
const maxHealthUpComponents = [rect(TILE_UNIT * 2, TILE_UNIT), color(1.0, 0, 0), "maxHealthUp"];
const maxBoostUpComponents = [rect(TILE_UNIT * 2, TILE_UNIT), color(0, 1.0, 1.0), "maxBoostUp"];
const boulderComponents = [rect(TILE_UNIT * 0.75, TILE_UNIT * 0.75), origin("center"), BOULDER_COLOR, "boulder"];
const fireballComponents = [rect(TILE_UNIT * 0.75, TILE_UNIT * 0.75), origin("center"), FIREBALL_COLOR, "fireball"];
const vortexComponents = [rect(TILE_UNIT * 0.75, TILE_UNIT * 0.75), origin("center"), VORTEX_COLOR, "vortex"];
const iceLanceComponents = [rect(TILE_UNIT, TILE_UNIT * 0.75), origin("center"), ICE_LANCE_COLOR, "iceLance"];
const getStandardTerrainComponents = (element) => [rect(TILE_UNIT, TILE_UNIT), getTerrainColorForElement(element), solid(), "terrain", "standardTerrain"];

const destroyBullet = (bullet) => {
    destroy(bullet);
    const bulletHitIndicator = add([...explosionComponents, pos(bullet.pos.x, bullet.pos.y)]);
    bulletHitIndicator.action(() => {
        bulletHitIndicator.width++;
        bulletHitIndicator.height++;
    });
    wait(0.125, () => {
        destroy(bulletHitIndicator);
    });
}

const breakCrate = (crate) => {
    destroy(crate);

    // Very rarely create an extra boost in the crate
    if (Math.round(rand(0, 1000)) % 100 === 0) {
        add([...extraBoostComponents, pos(crate.pos)]);
    } else if (Math.round(rand(0, 1000)) % 50 === 0) {
        // Less rarely add a major health potion
        add([...majorHealthPotionComponents, pos(crate.pos)]);
    } else if (Math.round(rand(0, 1000)) % 10 === 0) {
        // Even less rarely add a minor health potion
        add([...minorHealthPotionComponents, pos(crate.pos)]);
    } else if (Math.round(rand(0, 1000)) % 2 === 0) {
        // Fairly often add a coin
        add([...coinComponents, pos(crate.pos)]);
    }
}

const handleAirBlast = (obj) => {
    if (obj.jump) {
        obj.jump({ jumpForce: AIR_BLAST_FORCE });
    }
}

const createFireEffect = (parent, isFireball = false) => {
    const posX = isFireball ? parent.pos.x + (rand(0, TILE_UNIT / 2)) : parent.pos.x + (rand(-TILE_UNIT / 2, TILE_UNIT / 2));
    const posY = isFireball ? parent.pos.y + rand(-TILE_UNIT / 2, TILE_UNIT / 2) : parent.pos.y - (TILE_UNIT / 2);
    // Create a fire effect
    const flame = add([rect(TILE_UNIT / 2, TILE_UNIT / 2), origin("center"), FIREBALL_COLOR, pos(posX, posY)]);
    flame.action(() => {
        if (flame.width > 0) {
            flame.width -= 0.5;
            flame.height -= 0.5;
            // flame.pos.y += 0.5; // Account for shrinking height
            flame.pos.y -= 0.5 + rand(0, 0.5); // Rising flames
        } else {
            destroy(flame);
        }
    });
}

const mapTokenConfig = (element) => ({
    width: TILE_UNIT,
    height: TILE_UNIT,
    pos: vec2(0, 0),
    // End of level goal
    "*": goalComponents, // Goal
    // Terrain & hazards
    // TODO: Change colors based on element
    "x": [rect(TILE_UNIT, TILE_UNIT), color(0, 0, 0, 0), "outOfBounds", "kill"], // Kill the player if they go out of bounds (like in a pit)
    "=": getStandardTerrainComponents(element), // Ground
    "%": [rect(TILE_UNIT, TILE_UNIT), color(0.25, 0.25, 0.25), solid(), "crate"],// Destructible crates
    "#": getHazardTerrainForElement(element), // Elemental Hazard Terrain
    "!": getHazardForElement(element),
    "@": [rect(TILE_UNIT, TILE_UNIT), color(0.1, 0.1, 0.1), solid(), "exitBlocker"], // Exit blockers
    "+": [rect(TILE_UNIT, TILE_UNIT), METAL_SPIKE_COLOR, solid(), "kill", "spike"], // Metal spikes (non-elemental)
    // Collectibles & powerups
    "o": coinComponents, // Coin
    "P": ["playerStart"], // Player start
    "^": extraBoostComponents, // Extra boost powerup
    "§": respawningExtraBoostComponents, // Respawning Extra Boost powerup,
    "h": minorHealthPotionComponents, // Minor Health Potion
    "H": majorHealthPotionComponents, // Major Health Potion
    // Permanent items
    "R": [rect(TILE_UNIT * 2, TILE_UNIT), color(0.15, 1.0, 0.15), "remoteControl"], // TODO: Is this a useful item?
    "B": ["maxBoostUpSpawner"], // Permanent extra boost spawner (conditionally added if player doesn't have it already)
    "U": maxHealthUpComponents, // Permanent extra heart
    // Enemies
    "S": [rect(TILE_UNIT, TILE_UNIT), origin("center"), color(0.25, 0.75, 0.95), body(), { strength: 1, health: 1, scoreValue: 1 }, "slime", "enemy"],// Slime
    "G": [rect(TILE_UNIT, TILE_UNIT), origin("center"), color(0, 1.0, 0), body({ jumpForce: GOBLIN_JUMP_FORCE }), { strength: 1, health: 2, canShoot: true, scoreValue: 10 }, "goblin", "enemy"], // Goblin,
    "E": [rect(TILE_UNIT, TILE_UNIT), origin("center"), getElementalColor(element), body({ jumpForce: GOBLIN_JUMP_FORCE }), { strength: 2, health: 5, canShoot: true, scoreValue: 50 }, "elemental", "enemy", "spikeproof", getElementalResistanceTag(element)], // Elementals
    "f": [rect(TILE_UNIT, TILE_UNIT), FIREBALL_COLOR, { aggro: false, strength: 0.1, health: 1, target: null }, "flameBat", "enemy"], // Flame bat
    // Bosses
    "A": [rect(TILE_UNIT * 2, TILE_UNIT * 2), origin("center"), color(0.45, 0.75, 0.45), { strength: 2, health: 10, scoreValue: 150 }, "arachnos", "enemy"], // Arachnos (Boss 1)
    "F": [rect(TILE_UNIT * 2, TILE_UNIT * 2), origin("center"), color(0, 1, 0, 1), { numBats: 10 }, "flameBatSwarm"] // Flame bat swarm (Boss 2)
});

function addPlayer() {

    return add([
        rect(TILE_UNIT, TILE_UNIT),
        PLAYER_STATE.color,
        origin("center"),
        pos(-1000, -1000), // Start offscreen. Let every("playerStart") put the player in the right place
        body({ maxVel: MAX_VELOCITY, jumpForce: PLAYER_JUMP_FORCE }),
        "player",
        {
            boostTarget: null,
            canBoost: true,
            canShoot: true,
            health: 3,
            maxHealth: 3,
            maxBoosts: 1,
            numBoosts: 1,
            strength: 1,
            tempBoosts: 0,
            moveSpeed: PLAYER_MOVE_SPEED,
            isFreezing: false,
            score: 0
        }
    ]);
}

function sceneSetup({ player, element, currentLevel, nextLevel, map, hasRetried, targetMaxBoosts }) {
    PLAYER_STATE.health = PLAYER_STATE.maxHealth;
    PLAYER_STATE.maxBoosts = PLAYER_STATE.maxBoosts;
    PLAYER_STATE.isFreezing = false;
    PLAYER_STATE.isRockShocked = false;
    PLAYER_STATE.isBurning = false;

    // Make obj default layer
    layers([
        "effects",
        "obj",
        "ui",
    ], "obj");

    const sceneState = {
        defeatedEnemy: false,
        collectedItem: false,
        retried: hasRetried,
        tookDamage: false,
    };
    debug.showLog = true;
    gravity(GRAVITY);


    player.action(() => {
        camPos(player.pos.x, player.pos.y - 50);
    });

    const score = add([
        text(`Score: ${PLAYER_STATE.score}`, 8),
        color(1.0, 1.0, 0),
        pos(0, 0),
        { value: 0 },
        layer("ui")
    ]);


    const boostText = add([
        text(getBoostIndicators(player), 8),
        color(0, 1.0, 1.0),
        pos(150, 0),
        { value: PLAYER_STATE.maxBoosts + PLAYER_STATE.tempBoosts },
        layer("ui")
    ]);

    const healthText = add([
        text(getPlayerHealth(), 8),
        color(1.0, 0, 0),
        pos(300, 0),
        { value: PLAYER_STATE.health },
        layer("ui")
    ]);

    const ammoText = add([
        text(`Weapon: ${spellNames[PLAYER_STATE.ammoElement]}`, 8),
        color(1.0, 1.0, 0),
        pos(0, 20),
        layer("ui")
    ]);

    // Leave the UI alone as the camera moves around
    camIgnore(["ui"]);


    // Use the "playerStart" object from the map to set start position
    every("playerStart", (playerStart) => {
        player.pos.x = playerStart.pos.x;
        player.pos.y = playerStart.pos.y;
    });

    every("enemy", (enemy) => {
        enemy.collides("PLAYER_BULLET", (bullet) => {
            enemy.health -= bullet.strength;
        });

        enemy.collides("PLAYER_BOULDER", () => {
            enemy.isRockShocked = true;

            createStatusIndicator(EARTH_SPIKE_COLOR, enemy);

            wait(STATUS_TIMEOUT, () => {
                enemy.isRockShocked = false;
            });
        });

        enemy.collides("lava", () => {
            if (enemy._tags.indexOf("fireproof") < 0) {
                destroy(enemy);
                sceneState.defeatedEnemy = true;
            }
        });

        enemy.collides("spike", () => {
            if (enemy._tags.indexOf("spikeproof") < 0) {
                destroy(enemy);
                sceneState.defeatedEnemy = true;
            }
        });


        enemy.collides("airBlast", () => {
            handleAirBlast(enemy);
        });
    });

    action("enemy", (enemy) => {
        if (enemy.health <= 0) {
            destroy(enemy);
            sceneState.defeatedEnemy = true;
            const explosion = add([...explosionComponents, color(1.0, 0.5, 0), pos(enemy.pos.x, enemy.pos.y)]);
            explosion.action(() => {
                explosion.width++;
                explosion.height++;
            });
            PLAYER_STATE.score += enemy.scoreValue;
            score.text = `Score: ${PLAYER_STATE.score}`;
            wait(0.125, () => {
                destroy(explosion);
            });
        }
    });

    every("maxBoostUpSpawner", (maxBoostUpSpawner) => {
        if (PLAYER_STATE.maxBoosts < targetMaxBoosts) {
            add([...maxBoostUpComponents, pos(maxBoostUpSpawner.pos)]);
        }
    });

    every("elemental", (elemental) => {
        let direction = 1;

        elemental.action(() => {
            const differenceX = player.pos.x - elemental.pos.x;

            // If player is left of elemental
            if (differenceX < 0) {
                direction = -1;

                // If the elemental is within 20 units, move right
                if (differenceX > -100) {
                    direction = 1;
                }
            } else if (differenceX > 0) {
                direction = 1;

                if (differenceX < 100) {
                    direction = -1;
                }
            }

            if (elemental.isRockShocked) {
                direction *= -1;
            }

            if (elemental.pos.dist(player.pos) > CUTOFF_DISTANCE) {
                return;
            }
            elemental.move(25 * direction, 0);

            if (elemental.canShoot) {
                const fireDirection = player.pos.x - elemental.pos.x > 1 ? 1 : -1; // Hard-code this so it doesn't keep updating as direction updates
                elemental.canShoot = false;

                const bulletPos = vec2(elemental.pos.x + 10 * fireDirection, elemental.pos.y);

                switch (element) {
                    case EARTH:
                        // Earth Golem
                        const boulder = add([...boulderComponents, pos(bulletPos), "ENEMY_BOULDER"]);
                        boulder.action(() => {
                            boulder.move(BULLET_SPEED / 2 * fireDirection, -0.25);
                        });
                        boulder.collides("crate", (crate) => {
                            breakCrate(crate);
                        });
                        boulder.collides("terrain", () => {
                            destroyBullet(boulder);
                        });
                        boulder.collides("enemy", () => {
                            destroyBullet(boulder);
                        });
                        boulder.collides("PLAYER_BULLET", () => {
                            destroyBullet(boulder);
                        });
                        break;
                    case FIRE:
                        // Ifrit
                        const fireball = add([...fireballComponents, pos(bulletPos), "ENEMY_FIREBALL"]);
                        fireball.action(() => {
                            fireball.move((BULLET_SPEED * 0.5) * fireDirection, 0);

                            createFireEffect(fireball, true);
                        });
                        fireball.collides("crate", (crate) => {
                            breakCrate(crate);
                        });
                        fireball.collides("terrain", () => {
                            destroyBullet(fireball);
                        });
                        fireball.collides("PLAYER_BULLET", () => {
                            destroyBullet(fireball);
                        });
                        fireball.collides("enemy", () => {
                            destroyBullet(fireball);
                        });

                        break;
                    case AIR:
                        // Genie
                        const vortex = add([...vortexComponents, pos(bulletPos), "ENEMY_VORTEX"]);
                        vortex.action(() => {
                            if (vortex.pos.dist(player.pos) > CUTOFF_DISTANCE) {
                                return;
                            }
                            const directionX = vortex.pos.x - player.pos.x > 1 ? 1 : -1;
                            // Move toward the player
                            vortex.move(VORTEX_SPEED * fireDirection, 0);
                            if (vortex.pos.dist(player.pos) < 100) {
                                // Move the player toward the vortex
                                player.move(VORTEX_SPEED * directionX, 0);
                            }

                            // Add black hole effect
                            const particleX = rand(vortex.pos.x - TILE_UNIT, vortex.pos.x + TILE_UNIT);
                            const particleY = rand(vortex.pos.y - TILE_UNIT, vortex.pos.y + TILE_UNIT);
                            const particle = add([rect(TILE_UNIT / 4, TILE_UNIT / 4), VORTEX_COLOR, pos(particleX, particleY)]);
                            particle.action(() => {
                                const towardVortexX = particle.pos.x < vortex.pos.x ? 1 : -1;
                                const towardVortexY = particle.pos.y < vortex.pos.y ? 1 : -1;
                                if (particle.width > 0) {
                                    particle.width -= 0.1;
                                    particle.height -= 0.1;
                                }
                                particle.move(5 * towardVortexX, 5 * towardVortexY);
                            });

                            particle.collides("vortex", () => {
                                destroy(particle);
                            });

                            wait(0.25, () => {
                                if (particle.exists()) {
                                    destroy(particle);
                                }
                            });
                        });
                        vortex.collides("terrain", () => {
                            destroyBullet(vortex);
                        });
                        vortex.collides("PLAYER_BULLET", () => {
                            destroyBullet(vortex);
                        });
                        vortex.collides("enemy", () => {
                            destroyBullet(vortex);
                        });


                        wait(STATUS_TIMEOUT, () => {
                            destroy(vortex);
                        });

                        break;
                    case WATER:
                        // Frost Giant
                        const iceLance = add([...iceLanceComponents, pos(elemental.pos.x + (10 * fireDirection), elemental.pos.y), "ENEMY_ICE_LANCE"]);
                        iceLance.action(() => {
                            iceLance.move(BULLET_SPEED * 0.5 * fireDirection, 0);
                        });
                        iceLance.collides("terrain", () => {
                            destroyBullet(iceLance);
                        });
                        iceLance.collides("PLAYER_BULLET", () => {
                            destroyBullet(iceLance);
                        });
                        iceLance.collides("enemy", () => {
                            destroyBullet(iceLance);
                        });
                        iceLance.collides("crate", (crate) => {
                            breakCrate(crate);
                        });
                }

                wait(1.5, () => {
                    elemental.canShoot = true;
                });
            }
        });

    });

    every("goblin", (goblin) => {
        goblin.action(() => {
            const moveX = player.pos.x < goblin.pos.x ? -20 : 20;
            // Don't move if it's too far from the player
            if (goblin.pos.dist(player.pos) <= CUTOFF_DISTANCE) {
                if (goblin.isRockShocked) {
                    // Rock shock status messes with your sense of direction
                    goblin.move(moveX * -1, 0);
                } else {
                    goblin.move(moveX, 0);
                }

                // Don't shoot if it's too far from the player
                if (Math.round(rand(0, 100)) % 23 === 0 && goblin.canShoot) {
                    let bulletSpeedX = BULLET_SPEED;
                    let bulletSpeedY = 0;

                    // Shoot right if distance is positive, left if distance is negative
                    const direction = player.pos.x - goblin.pos.x >= 0 ? 1 : -1;

                    bulletSpeedX *= direction;

                    if (goblin.isRockShocked) {
                        bulletSpeedX *= -1;
                    }

                    const bullet = add([
                        rect(5, 5),
                        color(0.25, 1.0, 0.1),
                        origin("center"),
                        // pos(goblin.pos.x + 10 * direction, goblin.pos.y),
                        pos(goblin.pos),
                        "ENEMY_BULLET",
                        { strength: goblin.strength }
                    ]);

                    bullet.action(() => {
                        bullet.move(bulletSpeedX, bulletSpeedY);
                    });

                    bullet.collides("enemy", () => destroyBullet(bullet));
                    bullet.collides("ENEMY_BULLET", (enemyBullet) => {
                        destroyBullet(bullet);
                        destroyBullet(enemyBullet);
                    });
                    bullet.collides("terrain", () => destroyBullet(bullet));
                    bullet.collides("crate", (crate) => {
                        breakCrate(crate);
                        destroyBullet(bullet);
                    });

                    goblin.canShoot = false;

                    wait(2, () => {
                        destroy(bullet);
                        goblin.canShoot = true;
                    });
                }
            }
        });
    });

    every("slime", (slime) => {
        const moveX = -10;

        try {
            slime.action(() => {
                if (slime.pos.dist(player.pos) <= CUTOFF_DISTANCE) {
                    if (slime.isRockShocked) {
                        // Rock shock status messes with your sense of direction
                        slime.move(moveX * -1, 0);
                    } else {
                        slime.move(moveX, 0);
                    }
                }
            });
        } catch (e) {
            debug.log(e.message);
        }
    });

    // every("ember", (ember) => {
    //     let bubble;
    //     let direction = -1;
    //     ember.action(() => {
    //         if (ember.canJump && (!bubble || !bubble.exists())) {
    //             ember.canJump = false;

    //             // Create a bubble in the middle horizontally and slightly above the block
    //             bubble = add([rect(TILE_UNIT / 2, TILE_UNIT / 2), LAVA_BUBBLE_COLOR, pos(ember.pos.x + (TILE_UNIT / 4), ember.pos.y - (TILE_UNIT / 2)), body({ jumpForce: 150 })]);

    //             bubble.collides("ember", () => {
    //                 destroy(bubble);
    //             });

    //             bubble.jump();

    //             bubble.collides("player", () => {
    //                 PLAYER_STATE.health -= ember.strength;
    //                 healthText.text = getPlayerHealth();
    //             });
    //             bubble.collides("enemy", (enemy) => {
    //                 enemy.health -= ember.strength;
    //             });
    //             bubble.collides("terrain", () => {
    //                 destroy(bubble);
    //             });

    //             // bubble.action(() => {
    //             //     if (bubble.pos.y < (ember.pos.y - 10)) {
    //             //         direction = 1;
    //             //     } else if (bubble.pos.y >= (ember.pos.y)) {
    //             //         direction = -1;
    //             //     }
    //             //     bubble.move(0, 20 * direction);
    //             // })

    //             wait(1.5, () => {
    //                 ember.canJump = true;
    //             });
    //         }
    //     });
    // });

    every("icicle", (icicle) => {
        icicle.action(async () => {
            if (icicle.canFall && (icicle.pos.y < player.pos.y) && (Math.abs(icicle.pos.x - player.pos.x) < 5)) {
                await wait(0.25);
                const icicleDrop = add([rect(TILE_UNIT / 2, TILE_UNIT), ICICLE_COLOR, pos(icicle.pos.x + (TILE_UNIT / 4), icicle.pos.y + 10), body({ maxVel: 200 })]);

                icicleDrop.collides("player", () => {
                    PLAYER_STATE.health -= icicle.strength;
                    healthText.text = getPlayerHealth();
                    destroy(icicleDrop);
                });
                icicleDrop.collides("enemy", (enemy) => {
                    enemy.health -= icicle.strength;
                    destroy(icicleDrop);
                });
                icicleDrop.collides("terrain", () => {
                    destroy(icicleDrop);
                });

                icicle.canFall = false;

                wait(0.5, () => {
                    destroy(icicleDrop);
                });

                wait(1.5, () => {
                    icicle.canFall = true;
                });
            }
        });
    });

    every("spike", (spike) => {
        // Add spikes to make it look dangerous
        add([
            rect(TILE_UNIT / 8, TILE_UNIT),
            pos(spike.pos.x, spike.pos.y - (TILE_UNIT / 4)),
            METAL_SPIKE_COLOR,
        ]);
        add([
            rect(TILE_UNIT / 4, TILE_UNIT),
            pos(spike.pos.x + (TILE_UNIT / 2), spike.pos.y - (TILE_UNIT / 2)),
            METAL_SPIKE_COLOR,
        ]);
        add([
            rect(TILE_UNIT / 4, TILE_UNIT),
            pos(spike.pos.x + (TILE_UNIT / 2), spike.pos.y - (TILE_UNIT / 2)),
            METAL_SPIKE_COLOR,
        ]);
    });

    every("earthSpike", (spike) => {
        // Add spikes to make it look dangerous
        add([
            rect(TILE_UNIT / 8, TILE_UNIT),
            pos(spike.pos.x, spike.pos.y - (TILE_UNIT / 4)),
            EARTH_SPIKE_COLOR,
        ]);
        add([
            rect(TILE_UNIT / 4, TILE_UNIT),
            pos(spike.pos.x + (TILE_UNIT / 2), spike.pos.y - (TILE_UNIT / 2)),
            EARTH_SPIKE_COLOR
        ]);
        add([
            rect(TILE_UNIT / 4, TILE_UNIT),
            pos(spike.pos.x + (TILE_UNIT / 2), spike.pos.y - (TILE_UNIT / 2)),
            EARTH_SPIKE_COLOR
        ]);
    });

    every("arachnos", (arachnos) => {
        let target = vec2(player.pos.x + rand(-10, 10), player.pos.y + rand(-10, 10));

        arachnos.overlaps("terrain", () => {
            target = vec2(player.pos.x + rand(-10, 10), player.pos.y + rand(-10, 10));
        });

        arachnos.on("destroy", () => {
            const collectedRewards = [];
            const maxHealthUp = add([...maxHealthUpComponents, pos((map.width() / 2), 100)]);
            const maxBoostUp = add([...maxBoostUpComponents, pos((map.width() / 2) - 40, 100)]);
            const earthGun = add([rect(TILE_UNIT * 2, TILE_UNIT), EARTH_SPIKE_COLOR, pos((map.width() / 2) - 80, 100), "earthGun"]);


            for (let i = 0; i < 10; i++) {
                add([...coinComponents, pos((map.width() / 2) - (80 - (i * 10)), 100)]);
            }

            earthGun.collides("player", () => {
                PLAYER_STATE.availableAmmos.push(EARTH);
                destroy(earthGun);
            });

            maxHealthUp.collides("player", () => {
                PLAYER_STATE.maxHealth++;
                PLAYER_STATE.health = PLAYER_STATE.maxHealth;
                healthText.text = getPlayerHealth();
                sceneState.collectedItem = true;

                collectedRewards.push("maxHealthUp");

                if (!maxBoostUp.exists()) {
                    add([...goalComponents, pos(map.width() / 2, 50)]);
                }

                destroy(maxHealthUp);

            });

            maxBoostUp.collides("player", () => {
                PLAYER_STATE.maxBoosts++;
                PLAYER_STATE.numBoosts = PLAYER_STATE.maxBoosts;
                boostText.text = getBoostIndicators(player);
                sceneState.collectedItem = true;

                collectedRewards.push("maxBoostUp");
                if (!maxHealthUp.exists()) {
                    add([...goalComponents, pos(map.width() / 2, 50)]);
                }

                destroy(maxBoostUp);

            });
        });

        arachnos.action(() => {
            const distanceFromTarget = arachnos.pos.dist(target);
            const distanceFromPlayer = arachnos.pos.dist(player.pos);


            if (distanceFromPlayer > CUTOFF_DISTANCE) {
                return;
            }

            if (distanceFromTarget < arachnos.width) {
                target = vec2(player.pos.x + rand(-100, 100), player.pos.y + rand(-100, 100));
            }

            // TODO: Don't need this if terrain collisions aren't laggy
            // const distanceToRightBoundary = Math.abs(arachnos.pos.x - map.width());
            // const distanceToBottomBoundary = Math.abs(arachnos.pos.y - map.height());
            //  else if (
            //     distanceFromTarget < 5 ||
            //     distanceToRightBoundary < (arachnos.width * 2)
            //     || arachnos.pos.x < (arachnos.width * 2)
            //     || distanceToBottomBoundary < (arachnos.height * 2)
            //     || arachnos.pos.y < (arachnos.height * 2)
            // ) {
            //     // If we hit the target, or came close to the top or bottom or left or right world bounds
            //     target = vec2(player.pos.x + rand(-50, 50), player.pos.y + rand(-50, 50));
            // }

            const directionX = arachnos.pos.x < target.x ? 1 : -1;
            const directionY = arachnos.pos.y < target.y ? 1 : -1;
            const speed = distanceFromPlayer > 50 ? 100 : 10;
            arachnos.move(speed * directionX, speed * directionY);

            // }, 250));
        });
    });

    every("flameBat", (flameBat) => {
        createFireEffect(flameBat);
        flameBat.action(() => {
            if (!flameBat.target || flameBat.pos.dist(flameBat.target) < 5) {
                let targetX;
                let targetY;
                if (flameBat.aggro) {
                    targetX = rand(player.pos.x - 50, player.pos.x + 50);
                    targetY = rand(player.pos.y - 50, player.pos.y + 50);
                } else {

                    // Swarm around if not aggroed at player yet
                    targetX = rand(flameBat.pos.x - 10, flameBat.pos.x + 10);
                    targetY = rand(flameBat.pos.y - 10, flameBat.pos.y + 10);
                }

                flameBat.target = vec2(targetX, targetY);

            }

            // Once player gets close, get 'em!
            if (!flameBat.aggro && player.pos.dist(flameBat.pos) < 100) {
                flameBat.aggro = true;
            }

            flameBat.pos.x = lerp(flameBat.pos.x, flameBat.target.x, 0.125);
            flameBat.pos.y = lerp(flameBat.pos.y, flameBat.target.y, 0.125);

        });
    });

    every("flameBatSwarm", (swarm) => {
        const bats = [];

        on("destroy", "flameBat", (bat) => {
            bats.pop();

            if (bats.length === 0) {
                const collectedRewards = [];
                const maxHealthUp = add([...maxHealthUpComponents, pos((map.width() / 2), 100)]);
                const maxBoostUp = add([...maxBoostUpComponents, pos((map.width() / 2) - 40, 100)]);
                const fireGun = add([rect(TILE_UNIT * 2, TILE_UNIT), FIREBALL_COLOR, pos((map.width() / 2) - 80, 100), "fireGun"]);


                for (let i = 0; i < 10; i++) {
                    add([...coinComponents, pos((map.width() / 2) - (80 - (i * 10)), 100)]);
                }

                fireGun.collides("player", () => {
                    PLAYER_STATE.availableAmmos.push(FIRE);
                    destroy(fireGun);
                });

                maxHealthUp.collides("player", () => {
                    PLAYER_STATE.maxHealth++;
                    PLAYER_STATE.health = PLAYER_STATE.maxHealth;
                    healthText.text = getPlayerHealth();
                    sceneState.collectedItem = true;

                    collectedRewards.push("maxHealthUp");

                    if (!maxBoostUp.exists()) {
                        add([...goalComponents, pos(map.width() / 2, 50)]);
                    }

                    destroy(maxHealthUp);

                });

                maxBoostUp.collides("player", () => {
                    PLAYER_STATE.maxBoosts++;
                    PLAYER_STATE.numBoosts = PLAYER_STATE.maxBoosts;
                    boostText.text = getBoostIndicators(player);
                    sceneState.collectedItem = true;

                    collectedRewards.push("maxBoostUp");
                    if (!maxHealthUp.exists()) {
                        add([...goalComponents, pos(map.width() / 2, 50)]);
                    }

                    destroy(maxBoostUp);
                });
            }
        });
    });

    player.collides("goal", () => {
        go("interlude", { currentLevel, nextLevel, previousElement: element, ...sceneState });
    });

    player.collides("kill", () => {
        // Insta-kill the player (for things like lava and spikes)
        destroy(player);
        wait(1, () => {
            go(currentLevel, { currentLevel, previousElement: element, hasRetried: true });
        });
    });

    player.collides("spike", (spike) => {
        PLAYER_STATE.health -= spike.strength;
        healthText.text = getPlayerHealth();
    });

    player.collides("earthSpike", (spike) => {
        PLAYER_STATE.health -= spike.strength;
        healthText.text = getPlayerHealth();
    });

    player.collides("crumblingBlock", (crumblingBlock) => {
        // Shrink the block vertically to show that it's breaking, then destroy it
        action(() => {
            if (crumblingBlock.height > 0) {
                crumblingBlock.height--;
            }
        });
        wait(0.25, () => {
            destroy(crumblingBlock);
        })
    });

    player.collides("airBlast", () => {
        handleAirBlast(player);
    });

    player.collides("ice", () => {
        if (PLAYER_STATE.isFreezing) {
            // If already freezing, return early
            return;
        }

        if (player.grounded()) {
            PLAYER_STATE.isFreezing = true;
            createStatusIndicator(ICICLE_COLOR, player);
            wait(STATUS_TIMEOUT, () => {
                PLAYER_STATE.isFreezing = false;
            });
        }
    });

    player.collides("ember", () => {
        if (!PLAYER_STATE.isBurning) {
            PLAYER_STATE.isBurning = true;

            wait(STATUS_TIMEOUT, () => {
                PLAYER_STATE.isBurning = false;
            });
        }
    });

    player.collides("ENEMY_FIREBALL", (fireball) => {
        destroy(fireball);
        if (!PLAYER_STATE.isBurning) {
            PLAYER_STATE.isBurning = true;

            wait(STATUS_TIMEOUT, () => {
                PLAYER_STATE.isBurning = false;
            });
        }
    });


    player.collides("ENEMY_BOULDER", (boulder) => {
        destroy(boulder);
        if (!PLAYER_STATE.isRockShocked) {
            PLAYER_STATE.isRockShocked = true;

            createStatusIndicator(EARTH_SPIKE_COLOR, player);

            wait(STATUS_TIMEOUT, () => {
                PLAYER_STATE.isRockShocked = false;
            });
        }
    });

    player.collides("ENEMY_ICE_LANCE", (iceLance) => {
        destroy(iceLance);
        if (!PLAYER_STATE.isFreezing) {
            PLAYER_STATE.isFreezing = true;
            createStatusIndicator(ICE_LANCE_COLOR, player);

            wait(STATUS_TIMEOUT, () => {
                PLAYER_STATE.isFreezing = false;
            });
        }
    });

    player.collides("enemy", (enemy) => {
        PLAYER_STATE.health -= enemy.strength;
        healthText.text = getPlayerHealth();
        sceneState.tookDamage = true;
    });

    player.collides("ENEMY_BULLET", (bullet) => {
        PLAYER_STATE.health -= bullet.strength;
        destroy(bullet);
        healthText.text = getPlayerHealth();
        sceneState.tookDamage = true;
    });

    player.collides("coin", (coin) => {
        destroy(coin);
        PLAYER_STATE.score++;
        score.text = `Score: ${PLAYER_STATE.score}`;
        sceneState.collectedItem = true;
    });

    player.collides("healthPotion", (potion) => {
        destroy(potion);
        if (PLAYER_STATE.health + potion.strength < PLAYER_STATE.maxHealth) {
            PLAYER_STATE.health += potion.strength;
        } else {
            PLAYER_STATE.health = PLAYER_STATE.maxHealth;
        }
        healthText.text = getPlayerHealth(player);
        sceneState.collectedItem = true;
    });

    player.collides("extraBoost", (extraBoost) => {
        destroy(extraBoost);
        PLAYER_STATE.tempBoosts++;
        boostText.text = getBoostIndicators(player);
        sceneState.collectedItem = true;
    });

    // player.collides("maxBoostUp", (maxBoostUp) => {

    // });

    // player.collides("maxHealthUp", (maxHealthUp) => {

    // });

    player.collides("respawningExtraBoost", (respawningExtraBoost) => {
        const itemPos = respawningExtraBoost.pos;

        destroy(respawningExtraBoost);

        PLAYER_STATE.tempBoosts++;
        boostText.text = getBoostIndicators(player);
        sceneState.collectedItem = true;

        wait(5, () => {
            add([...respawningExtraBoostComponents, pos(itemPos.x, itemPos.y)]);
        });
    });

    player.collides("remoteControl", (remoteControl) => {
        PLAYER_STATE.hasRemoteControl = true;
        PLAYER_STATE.color = color(0.15, 1.0, 0.15);
        destroy(remoteControl);
    });

    // there's no spatial hashing yet, if too many blocks causing lag, consider hard disabling collision resolution from blocks far away by turning off 'solid'
    // (from the Kaboom docs)
    // Re-enable and troubleshoot if performance tanks
    // action("terrain", (terrain) => {
    //     terrain.solid = player.pos.dist(terrain.pos) <= CUTOFF_DISTANCE;
    // });


    keyDown(SHOOT, () => {
        if (player.canShoot) {
            let bulletSpeedX = BULLET_SPEED;
            let bulletSpeedY = 0;

            const direction = PLAYER_STATE.direction;

            let bullet;


            switch (PLAYER_STATE.ammoElement) {
                case EARTH:
                    bullet = add([...boulderComponents, pos(player.pos), origin("center"), "PLAYER_BULLET", "PLAYER_BOULDER", { strength: BOULDER_STRENGTH }]);
                    bullet.collides("pit", (pit) => {
                        const x = pit.pos.x;
                        const y = pit.pos.y;

                        destroy(pit);

                        // Boulders replace pits with standard terrain
                        add([...getStandardTerrainComponents(element), pos(x, y)]);
                    });

                    bullet.collides("airBlast", (airBlast) => {
                        const x = airBlast.pos.x;
                        const y = airBlast.pos.y;

                        destroy(airBlast);

                        // Boulders replace air blasts with standard terrain
                        add([...getStandardTerrainComponents(element), pos(x, y)]);
                    });
                    break;
                case FIRE:
                    bullet = add([...fireballComponents, pos(player.pos), "PLAYER_BULLET", "PLAYER_FIREBALL", { strength: FIREBALL_STRENGTH }]);

                    createFireEffect(bullet, true);

                    bullet.collides("icicle", (icicle) => {
                        const x = icicle.pos.x;
                        const y = icicle.pos.y;

                        destroy(icicle);

                        // Fireballs replace icicles with standard terrain
                        add([...getStandardTerrainComponents(element), pos(x, y)]);
                    });
                case NONE:
                default:
                    bullet = add([
                        rect(5, 5),
                        color(1.0, 1.0, 100),
                        pos(player.pos),
                        origin("center"),
                        "PLAYER_BULLET",
                        { strength: BULLET_STRENGTH }
                    ]);
            }

            bullet.collides("enemy", () => destroyBullet(bullet));
            bullet.collides("enemy", (enemyBullet) => {
                destroyBullet(bullet);
                destroyBullet(enemyBullet);
            });
            bullet.collides("terrain", () => destroyBullet(bullet));
            bullet.collides("crate", (crate) => {
                breakCrate(crate);
                destroyBullet(bullet);
            });

            if (keyIsDown(UP)) {
                bulletSpeedX = 0;
                bulletSpeedY = -BULLET_SPEED;
            } else if (keyIsDown(DOWN)) {
                bulletSpeedX = 0;
                bulletSpeedY = BULLET_SPEED;
            }

            bullet.action(() => {
                // The Remote Control power lets players redirect their bullets in the air!
                if (PLAYER_STATE.hasRemoteControl) {
                    bullet.move(bulletSpeedX * PLAYER_STATE.direction, bulletSpeedY);
                } else {
                    bullet.move(bulletSpeedX * direction, bulletSpeedY);
                }
            });

            player.canShoot = false;

            wait(0.25, () => {
                player.canShoot = true;
            });

            wait(1, () => {
                destroy(bullet);
            });
        }
    });

    // If they're boosting or airborne or holding down the aim button, ignore arrow keys
    keyPress(UP, () => {
        if (player.grounded() && !player.boostTarget && !keyIsDown(AIM)) {
            player.jump();
        }
    });

    keyDown(RIGHT, () => {
        let speed = PLAYER_STATE.moveSpeed;

        if (PLAYER_STATE.isFreezing) {
            speed *= 2;
        }

        if (PLAYER_STATE.isRockShocked) {
            PLAYER_STATE.direction = -1;
            speed *= 0.5;

            // If they're boosting or holding down the aim button, ignore arrow keys
            if (!player.boostTarget && !keyIsDown(AIM)) {
                player.move(-speed, 0);
            }
        } else {
            PLAYER_STATE.direction = 1;

            // If they're boosting or holding down the aim button, ignore arrow keys
            if (!player.boostTarget && !keyIsDown(AIM)) {
                player.move(speed, 0);
            }
        }
    });

    keyDown(LEFT, () => {
        let speed = PLAYER_STATE.moveSpeed;

        if (PLAYER_STATE.isFreezing) {
            speed *= 2;
        }

        if (PLAYER_STATE.isRockShocked) {
            PLAYER_STATE.direction = 1;
            speed *= 0.5;
            // If they're boosting or holding down the aim button, ignore arrow keys
            if (!player.boostTarget && !keyIsDown(AIM)) {
                player.move(speed, 0);
            }
        } else {
            PLAYER_STATE.direction = -1;
            // If they're boosting or holding down the aim button, ignore arrow keys
            if (!player.boostTarget && !keyIsDown(AIM)) {
                player.move(-speed, 0);
            }
        }
    });

    keyPress(BOOST, () => {
        let speed = PLAYER_BOOST_SPEED;

        if (PLAYER_STATE.isRockShocked) {
            speed *= 0.5;
        } else if (PLAYER_STATE.isBurning) {
            speed *= 1.5;
        }

        // if (player.canBoost) {
        if ((PLAYER_STATE.numBoosts + PLAYER_STATE.tempBoosts) > 0) {
            if (keyIsDown(RIGHT)) {
                if (keyIsDown(UP)) {
                    // If up and right are both pressed
                    // Divide Y boost by two because otherwise it seems too good
                    player.boostTarget = vec2(player.pos.x + speed, player.pos.y - (speed / 2));
                } else if (keyIsDown(DOWN)) {
                    // If down and right are both pressed
                    if (player.grounded()) {
                        // If grounded, just go right
                        player.boostTarget = vec2(player.pos.x + speed, player.pos.y);
                    } else {
                        // Divide Y boost by two because otherwise it seems too good
                        player.boostTarget = vec2(player.pos.x + speed, player.pos.y + (speed / 2));
                    }
                } else {
                    // If just right is pressed
                    player.boostTarget = vec2(player.pos.x + speed, player.pos.y);
                }
            } else if (keyIsDown(LEFT)) {
                if (keyIsDown(UP)) {
                    // If up and left are both pressed
                    // Divide Y boost by two because otherwise it seems too good
                    player.boostTarget = vec2(player.pos.x - speed, player.pos.y - (speed / 2));
                } else if (keyIsDown(DOWN)) {
                    // If down and left are both pressed
                    if (player.grounded()) {
                        // If grounded, just go left
                        player.boostTarget = vec2(player.pos.x - speed, player.pos.y);
                    } else {
                        // Divide Y boost by two because otherwise it seems too good
                        player.boostTarget = vec2(player.pos.x - speed, player.pos.y + (speed / 2))
                    }
                } else {
                    // If just left is pressed
                    player.boostTarget = vec2(player.pos.x - speed, player.pos.y);
                }
            } else if (keyIsDown(UP)) {
                // If just up is pressed
                // Dividing by two because otherwise it seems too good
                player.boostTarget = vec2(player.pos.x, player.pos.y - (speed / 2));
            } else if (keyIsDown(DOWN) && !player.grounded()) {
                // If just down is pressed
                player.boostTarget = vec2(player.pos.x, player.pos.y + speed);
            } else {
                // If NO KEYS are pressed, go right
                player.boostTarget = vec2(player.pos.x + speed, player.pos.y);
            }
            // Disable ALL gravity when boosting
            gravity(0);

            // Boosting puts out fires
            PLAYER_STATE.isBurning = false;

            // player.canBoost = false;
            if (PLAYER_STATE.numBoosts > 0) {
                PLAYER_STATE.numBoosts--;
            } else if (PLAYER_STATE.tempBoosts > 0) {
                PLAYER_STATE.tempBoosts--;
            }

            // Update the UI indicator of the number of boosts available
            boostText.text = getBoostIndicators(player);

            // Clear out boost target after .25s to avoid player getting pulled toward target forever
            wait(0.25, () => {
                gravity(GRAVITY);
                player.boostTarget = null;
            });
        }
    });

    keyPress(AMMO_CYCLE_BACK, () => {
        if (PLAYER_STATE.availableAmmos.length > 1) {
            const currentIndex = PLAYER_STATE.availableAmmos.indexOf(PLAYER_STATE.ammoElement);
            const nextIndex = currentIndex - 1 >= 0 ? currentIndex - 1 : PLAYER_STATE.availableAmmos.length;
            PLAYER_STATE.ammoElement = PLAYER_STATE.availableAmmos[nextIndex];

            ammoText.text = `Weapon: ${spellNames[PLAYER_STATE.ammoElement]}`;
        }
    });

    keyPress(AMMO_CYCLE_FORWARD, () => {
        if (PLAYER_STATE.availableAmmos.length > 1) {
            const currentIndex = PLAYER_STATE.availableAmmos.indexOf(PLAYER_STATE.ammoElement);
            const nextIndex = currentIndex + 1 < PLAYER_STATE.availableAmmos.length ? currentIndex + 1 : 0;
            PLAYER_STATE.ammoElement = PLAYER_STATE.availableAmmos[nextIndex];

            ammoText.text = `Weapon: ${spellNames[PLAYER_STATE.ammoElement]}`;
        }
    });

    player.action(() => {

        if (PLAYER_STATE.health <= 0) {
            destroy(player);
            wait(1, () => {
                go(currentLevel, { currentLevel, previousElement: element, hasRetried: true });
            });
        }

        if (PLAYER_STATE.isFreezing) {
            // If frozen, keep moving in direction even when not moving (sliding)
            player.move((PLAYER_STATE.moveSpeed * PLAYER_STATE.direction / 2), 0);
            PLAYER_STATE.health -= 0.0125;
            healthText.text = getPlayerHealth();
        }

        if (PLAYER_STATE.isBurning) {
            // Take damage each frame
            PLAYER_STATE.health -= 0.0125;
            healthText.text = getPlayerHealth();

            createFireEffect(player);
        }

        // If they boosted, give them their boost back when they hit the ground
        if (player.grounded() && PLAYER_STATE.numBoosts < PLAYER_STATE.maxBoosts) {
            PLAYER_STATE.numBoosts++;
            // Update the UI indicator of the number of boosts available
            boostText.text = getBoostIndicators(player);
        }

        if (player.boostTarget) {
            // Create a cool shrinking trail
            const boostTrailSquare = add([rect(TILE_UNIT / 2, TILE_UNIT / 2), color(1, 1, 1), pos(player.pos.x - 1, player.pos.y)]);
            boostTrailSquare.action(() => {
                if (boostTrailSquare.width > 0) {
                    boostTrailSquare.width -= 0.5;
                    boostTrailSquare.height -= 0.5;
                }
            });

            wait(0.25, () => {
                destroy(boostTrailSquare);
            });

            const distanceToTarget = Math.sqrt((player.boostTarget.x - player.pos.x) ** 2 + (player.boostTarget.y - player.pos.y) ** 2);

            // If player is already at target, set target to null and return early
            if (Math.round(distanceToTarget) === 0) {
                return player.boostTarget = null;
            }
            // Lerp 3 steps to boost target
            const nextPos = vec2(lerp(player.pos.x, player.boostTarget.x, 3), lerp(player.pos.y, player.boostTarget.y, 3));
            player.move(nextPos.x - player.pos.x, nextPos.y - player.pos.y);
        }
    });
}

function getPlayerHealth() {
    // TODO: Mark quarter hearts, etc
    // Create a * character for each heart available
    let health = '';
    for (let i = 0; i < (PLAYER_STATE.health); i++) {
        health += '*';
    }

    return `Health: ${health}`;
}

/**
 * 
 * @param {object} player The player object. Needed for getting the number of available boosts
 * plus temporary boosts currently collected
 * @returns 
 */
function getBoostIndicators(player) {
    // Create a * character for each boost available
    let boostIndicators = '';
    for (let i = 0; i < (PLAYER_STATE.numBoosts + PLAYER_STATE.tempBoosts); i++) {
        boostIndicators += '*';
    }

    return `Boosts: ${boostIndicators || ' '}`;
}

scene("gameOver", ({ returnScene, lastElement }) => {
    add([text("Game Over. Press ENTER to try again", 12), pos(width() / 2, height() / 2)]);

    keyPress(["enter", "space"], () => {
        const newElement = getElement(lastElement);
        go(returnScene, { element: newElement });
    });
});

scene("one", ({ previousElement }) => {
    const nextLevel = "two";
    const element = getElement(previousElement);
    const map = addLevel([
        "x==============================x",
        "x=                            =x",
        "x=                            =x",
        "x=                          * =x",
        "x=            o           =====x",
        "x=          o ==              =x",
        "x=        o                   =x",
        "x=      o                     =x",
        "x=ooo o                       =x",
        "x====                     oooo=x",
        "x=                 o o    =====x",
        "x=              o  ====       =x",
        "x=            o               =x",
        "x= P         o                =x",
        "x=================######=======x",
        "x                              x",
        "x                              x",
        "x                              x",
        "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    ],
        mapTokenConfig(element)
    );

    const player = addPlayer();

    sceneSetup({ player, element, currentLevel: "one", nextLevel, map });

    // Use the "playerStart" object from the map to set start position
    every("playerStart", (playerStart) => {
        player.pos.x = playerStart.pos.x;
        player.pos.y = playerStart.pos.y;
    });
});

scene("two", ({ previousElement }) => {
    const nextLevel = "three";
    const element = getElement(previousElement);
    const map = addLevel([
        "x========================================================================x",
        "x=                         !!                            %              =x",
        "x=                                           ooooooooooo %              =x",
        "x=                                          ====         %              =x",
        "x=                                           !!          %     ##       =x",
        "x=                                                       %              =x",
        "x=                                                       %     oo     * =x",
        "x= oo              ==           ==           !!          ================x",
        "x======                    !!                                           =x",
        "x=                                                                      =x",
        "x=               !!!!!!                             ooo             %%% =x",
        "x=                                                 o   o            %h% =x",
        "x= P                         =       S h      =               G     %%% =x",
        "x==========######!!!!!!######=======================######!!!!!####======x",
        "x                                                                        x",
        "x                                                                        x",
        "x                                                                        x",
        "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    ],
        mapTokenConfig(element)
    );

    const player = addPlayer();

    sceneSetup({ player, element, currentLevel: "two", nextLevel, map });
});

scene("three", ({ previousElement }) => {
    const nextLevel = "four";

    // const element = getElement(previousElement);
    // Arachnos is the Earth boss! His lair is always earth
    const element = EARTH;

    const player = addPlayer();

    // Arachnos boss fight:
    const map = addLevel([
        "x=====================================x",
        "x= o h o%          A          %o H o =x",
        "x=%%%%%%%                     %%%%%%%=x",
        "x=                                   =x",
        "x=                                   =x",
        "x=                                   =x",
        "x=                                   =x",
        "x=       ==###==       ==###==       =x",
        "x=                                   =x",
        "x=                                   =x",
        "x=                                   =x",
        "x=           #####===#####           =x",
        "x=                                   =x",
        "x========     !!!!###!!!!    =========x",
        "x=                                   =x",
        "x=                             %   % =x",
        "x= P                          %o% %o%=x",
        "x===========###############===========x",
        "x                                     x",
        "x                                     x",
        "x                                     x",
        "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",

    ],
        mapTokenConfig(element)
    );

    sceneSetup({ player, element, currentLevel: "three", nextLevel, map });
});

scene("four", ({ previousElement, targetMaxBoosts = 2 }) => {
    const nextLevel = "five";
    const element = getElement(previousElement);

    PLAYER_STATE.availableAmmos.push(EARTH);

    const map = addLevel([
        "x============================================x",
        "x=                                          =x",
        "x=                                 h^h      =x",
        "x=                                 ===      =x",
        "x=                                          =x",
        "x=  P                                       =x",
        "x= ===                                      =x",
        "x=                                          =x",
        "x=                                          =x",
        "x=   o                    o                 =x",
        "x=  ===                   =                 =x",
        "x=                                          =x",
        "x=            ####++++####++++####++++####++=x",
        "x=                                          =x",
        "x=         oooooooo  ooooo                  =x",
        "x=     =====              oo                =x",
        "x=                           ooooo          =x",
        "x=            ++###++###++#+   ===       *  =x",
        "x=                                          =x",
        "x=                                #####+++++=x",
        "x=++++++++++++++++++++++++++++++++++++++++++=x",
        "x                                            x",
        "x                                            x",
        "x                                            x",
        "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    ], mapTokenConfig(element));


    const player = addPlayer();

    sceneSetup({ player, element, currentLevel: "four", nextLevel, map, targetMaxBoosts });
});

scene("five", ({ previousElement }) => {
    const nextLevel = "six";
    const element = getElement(previousElement);
    const map = addLevel([
        "x===================================================================x",
        "x=  %                                                           %% =x",
        "x= % %                                                         %%%%=x",
        "x======!!!!!!=====                                       !!!!!======x",
        "x=                                                                 =x",
        "x=                                                                 =x",
        "x=                                                       !!!       =x",
        "x=                                                                 =x",
        "x=                  ======                                 #######=x",
        "x=                                                                 =x",
        "x=                                                                 =x",
        "x=                                              o                  =x",
        "x=         ===                 =                o                E =x",
        "x=                             =======#######%%%%%%%###############=x",
        "x=    +++      +++   %                          o                  =x",
        "x=                  % %                        === ooooooooo       =x",
        "x= P               % % %                                     ooo * =x",
        "x=====###!!!!!!###========######!!!!!!#######+++++++########========x",
        "x                                                                   x",
        "x                                                                   x",
        "x                                                                   x",
        "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",

    ],
        mapTokenConfig(element)
    );

    const player = addPlayer();

    sceneSetup({ player, element, currentLevel: "five", nextLevel, map });
});

scene("six", ({ previousElement }) => {
    const nextLevel = "seven";
    // Flame bat swarm is always fire
    const element = FIRE;
    const map = addLevel([
        "x=================================================================================================x",
        "x=                                                                                               =x",
        "x=                                              fffff                                            =x",
        "x=                                              ffFff                                            =x",
        "x=                                              fffff                                            =x",
        "x=                                                                                               =x",
        "x=                                                                                               =x",
        "x=                                          ====!!!!!====                                        =x",
        "x=                                                                                               =x",
        "x=                                                                                               =x",
        "x=                                                                                               =x",
        "x=                                                                                               =x",
        "x=           %%                                                                     %%       %%  =x",
        "x= P        %%%%                                                                   %%%%     %%%% =x",
        "x================                                                                 ================x",
        "x=                                       ====!!!==#==!!!====                                     =x",
        "x=                                                                                               =x",
        "x=                                                                                               =x",
        "x=                                                                                               =x",
        "x=                                                                                               =x",
        "x=                                                                                               =x",
        "x=               ===============                                   ===============               =x",
        "x=                                                                                               =x",
        "x=                                                                                               =x",
        "x=    %%                                                                                   %%    =x",
        "x= h %%%%                       !!!!!#########!!!!!!!!########!!!!!                       %%%% h =x",
        "x= ========                                                                             ======== =x",
        "x=                                                                                               =x",
        "x=                                                                                               =x",
        "x=###############################################################################################=x",
        "x                                                                                                 x",
        "x                                                                                                 x",
        "x                                                                                                 x",
        "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",

    ],
        mapTokenConfig(element)
    );

    const player = addPlayer();

    sceneSetup({ player, element, currentLevel: "six", nextLevel, map });
});

scene("interlude", ({ currentLevel, previousElement, nextLevel, tookDamage, defeatedEnemy, collectedItem, retried }) => {
    add([
        text(`
        Level ${currentLevel} complete!

        Thief's log:

        `, 10),
        pos(10, 0)
    ]);

    const bragText = generateBragText({ tookDamage, defeatedEnemy, collectedItem, retried });

    add([
        text(`"${bragText}"`, 6),
        pos(10, 100)
    ]);

    add([
        text("Press ENTER to continue", 8),
        pos(10, 150)
    ]);

    keyPress("enter", () => {
        go(nextLevel, { previousElement });
    });


});




const overrides = (window.location.search.match(/\?levelOverride=(\w*)(?:&elementOverride=(\w*)?)/));
const levelOverride = (overrides || [])[1];
const elementOverride = (overrides || [])[2];

start(levelOverride ? levelOverride : "one", { previousElement: elementOverride || undefined });
